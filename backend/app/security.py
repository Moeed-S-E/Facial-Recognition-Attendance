from __future__ import annotations

import hashlib
import math
import time
from collections import deque
from threading import Lock

from fastapi import HTTPException, Request, WebSocket, status

from .config import Settings

class InMemoryRateLimiter:
    """Small process-local sliding-window limiter for a single API instance.

    Production deployments with multiple replicas should replace this storage
    with a shared Redis/edge limiter. The interface intentionally stays narrow so
    that migration does not change endpoint behavior.
    """

    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = {}
        self._violations: dict[str, int] = {}
        self._blocked_until: dict[str, float] = {}
        self._lock = Lock()

    def hit(
        self,
        key: str,
        limit: int,
        window_seconds: int,
        max_backoff_seconds: int,
    ) -> int | None:
        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            events = self._events.setdefault(key, deque())
            while events and events[0] <= cutoff:
                events.popleft()

            blocked_until = self._blocked_until.get(key, 0.0)
            if blocked_until > now:
                violation_count = self._violations.get(key, 1) + 1
                self._violations[key] = violation_count
                retry_after = min(
                    max_backoff_seconds,
                    window_seconds * (2 ** min(violation_count - 1, 8)),
                )
                self._blocked_until[key] = now + retry_after
                return max(1, math.ceil(retry_after))

            if len(events) >= limit:
                violation_count = self._violations.get(key, 0) + 1
                self._violations[key] = violation_count
                base_retry = max(1.0, events[0] + window_seconds - now)
                exponential_retry = window_seconds * (2 ** min(violation_count - 1, 8))
                retry_after = min(max_backoff_seconds, max(base_retry, exponential_retry))
                self._blocked_until[key] = now + retry_after
                return max(1, math.ceil(retry_after))

            events.append(now)
            self._violations.pop(key, None)
            self._blocked_until.pop(key, None)
            if len(self._events) > 10_000:
                self._prune_locked(cutoff)
        return None

    def _prune_locked(self, cutoff: float) -> None:
        stale = [key for key, events in self._events.items() if not events or events[-1] <= cutoff]
        for key in stale:
            self._events.pop(key, None)
            self._violations.pop(key, None)
            self._blocked_until.pop(key, None)


rate_limiter = InMemoryRateLimiter()


def client_identifier(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def enforce_rate_limit(
    request: Request,
    settings: Settings,
    *,
    scope: str,
    account_key: str | None = None,
    limit: int | None = None,
) -> None:
    """Apply a configurable per-IP and optional per-account limit."""

    ip_key = f"{scope}:ip:{client_identifier(request)}"
    ip_limit = limit if limit is not None else (
        settings.auth_rate_limit_per_ip if scope == "auth" else settings.public_rate_limit_per_ip
    )
    retry_after = rate_limiter.hit(
        ip_key,
        ip_limit,
        settings.rate_limit_window_seconds,
        settings.rate_limit_max_backoff_seconds,
    )
    if retry_after is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    if account_key:
        digest = hashlib.sha256(account_key.strip().lower().encode("utf-8")).hexdigest()
        account_limit = (
            settings.auth_rate_limit_per_account
            if scope == "auth"
            else settings.pin_rate_limit_per_account
            if scope == "pin-verification"
            else settings.authenticated_rate_limit_per_account
        )
        retry_after = rate_limiter.hit(
            f"{scope}:account:{digest}",
            account_limit,
            settings.rate_limit_window_seconds,
            settings.rate_limit_max_backoff_seconds,
        )
        if retry_after is not None:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
                headers={"Retry-After": str(retry_after)},
            )


def enforce_websocket_rate_limit(
    websocket: WebSocket,
    settings: Settings,
    *,
    account_key: str | None = None,
) -> int | None:
    """Return retry seconds for an auth-sensitive websocket attempt, if limited."""

    client_host = websocket.client.host if websocket.client else "unknown"
    retry_after = rate_limiter.hit(
        f"websocket:ip:{client_host}",
        settings.auth_rate_limit_per_ip,
        settings.rate_limit_window_seconds,
        settings.rate_limit_max_backoff_seconds,
    )
    if retry_after is not None:
        return retry_after

    if account_key:
        digest = hashlib.sha256(account_key.strip().lower().encode("utf-8")).hexdigest()
        return rate_limiter.hit(
            f"websocket:account:{digest}",
            settings.auth_rate_limit_per_account,
            settings.rate_limit_window_seconds,
            settings.rate_limit_max_backoff_seconds,
        )
    return None


def require_development_demo(request: Request, settings: Settings) -> None:
    """Keep seed/demo routes out of staging and production."""

    enforce_rate_limit(request, settings, scope="demo", limit=settings.demo_rate_limit_per_ip)
    if settings.environment != "development":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found.",
        )


def validate_jpeg_bytes(content: bytes) -> bool:
    """Check JPEG magic bytes rather than trusting the client MIME type."""

    return len(content) >= 4 and content[:3] == b"\xff\xd8\xff" and content[-2:] == b"\xff\xd9"
