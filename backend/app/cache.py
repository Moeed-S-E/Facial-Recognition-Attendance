"""Small fail-open Valkey cache wrapper."""

from __future__ import annotations

import logging
import redis.asyncio as redis

from .config import Settings

logger = logging.getLogger(__name__)
_client: redis.Redis | None = None


def _get_client(settings: Settings) -> redis.Redis | None:
    global _client
    if not settings.cache_enabled:
        return None
    if _client is None:
        _client = redis.from_url(settings.valkey_url, decode_responses=True)
    return _client


async def cache_get_json(key: str, settings: Settings) -> str | None:
    client = _get_client(settings)
    if client is None:
        return None
    try:
        return await client.get(key)
    except Exception:
        logger.warning("Valkey read failed", exc_info=True)
        return None


async def cache_set_json(key: str, value: str, settings: Settings, ttl: int | None = None) -> None:
    client = _get_client(settings)
    if client is None:
        return
    try:
        await client.set(key, value, ex=ttl or settings.cache_ttl_seconds)
    except Exception:
        logger.warning("Valkey write failed", exc_info=True)


async def cache_delete(key: str, settings: Settings) -> None:
    client = _get_client(settings)
    if client is None:
        return
    try:
        await client.delete(key)
    except Exception:
        logger.warning("Valkey delete failed", exc_info=True)


async def close_cache() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


__all__ = ["cache_delete", "cache_get_json", "cache_set_json", "close_cache"]

