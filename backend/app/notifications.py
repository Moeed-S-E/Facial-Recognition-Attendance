from __future__ import annotations

import asyncio
import hmac
import logging
import re
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket

from .config import Settings

logger = logging.getLogger(__name__)
USER_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:@+-]{1,128}$")


class NotificationHub:
    """Fan out realtime events to connected users on one backend process.

    The hub deliberately keeps transport state out of the database. It is
    suitable for one Azure VM process. Before running multiple workers or VM
    instances, replace it with a shared Redis/pub-sub adapter.
    """

    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.setdefault(user_id, set()).add(websocket)

    async def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            connections = self._connections.get(user_id)
            if not connections:
                return
            connections.discard(websocket)
            if not connections:
                self._connections.pop(user_id, None)

    async def publish(self, recipient_user_id: str, event_type: str, title: str, message: str, **data: Any) -> int:
        payload = {
            "type": event_type,
            "title": title,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data,
        }
        async with self._lock:
            connections = list(self._connections.get(recipient_user_id, set()))

        delivered = 0
        stale: list[WebSocket] = []
        for websocket in connections:
            try:
                await websocket.send_json(payload)
                delivered += 1
            except Exception:
                stale.append(websocket)

        for websocket in stale:
            await self.disconnect(recipient_user_id, websocket)
        return delivered


notification_hub = NotificationHub()


def valid_notification_user_id(user_id: str) -> bool:
    return bool(USER_ID_PATTERN.fullmatch(user_id))


def build_notification_subject_token(user_id: str, settings: Settings, ttl_seconds: int = 300) -> str:
    """Create a short-lived subject-bound token for an authenticated session service."""

    secret = settings.notification_ws_token.get_secret_value() if settings.notification_ws_token else ""
    if not secret or not valid_notification_user_id(user_id):
        raise ValueError("A websocket signing secret and valid user id are required")
    expires_at = int(time.time()) + max(30, min(ttl_seconds, 3600))
    message = f"{user_id}.{expires_at}"
    signature = hmac.new(secret.encode("utf-8"), message.encode("utf-8"), "sha256").hexdigest()
    return f"{message}.{signature}"


def notification_token_is_valid(websocket: WebSocket, settings: Settings, user_id: str) -> bool:
    """Validate a short-lived token bound to the requested websocket subject.

    A raw deployment secret is never accepted as a browser credential. The
    eventual authentication/session service must mint the signed subject token
    after confirming that the caller owns ``user_id``.
    """

    secret = settings.notification_ws_token.get_secret_value() if settings.notification_ws_token else None
    supplied = websocket.query_params.get("token")
    if not supplied:
        authorization = websocket.headers.get("authorization", "")
        if authorization.lower().startswith("bearer "):
            supplied = authorization[7:].strip()

    if not secret or not supplied:
        return settings.environment == "development" and settings.notification_ws_allow_unauthenticated_development

    try:
        subject, expires_text, signature = supplied.split(".", 2)
        expires_at = int(expires_text)
    except (TypeError, ValueError):
        return False

    if subject != user_id or expires_at < int(time.time()):
        return False
    message = f"{subject}.{expires_at}"
    expected_signature = hmac.new(secret.encode("utf-8"), message.encode("utf-8"), "sha256").hexdigest()
    return hmac.compare_digest(signature, expected_signature)
