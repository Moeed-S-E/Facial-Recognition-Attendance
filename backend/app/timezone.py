from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

DEFAULT_APP_TIMEZONE = "Asia/Karachi"


def app_zone(timezone_name: str = DEFAULT_APP_TIMEZONE) -> ZoneInfo:
    return ZoneInfo(timezone_name)


def utc_now_naive() -> datetime:
    """Return a UTC timestamp matching the database's existing naive-UTC columns."""
    return datetime.now(UTC).replace(tzinfo=None)


def local_now(timezone_name: str = DEFAULT_APP_TIMEZONE) -> datetime:
    return datetime.now(app_zone(timezone_name))


def local_today(timezone_name: str = DEFAULT_APP_TIMEZONE) -> date:
    return local_now(timezone_name).date()


def local_day_bounds_utc_naive(timezone_name: str = DEFAULT_APP_TIMEZONE) -> tuple[datetime, datetime]:
    local_start = datetime.combine(local_today(timezone_name), time.min, tzinfo=app_zone(timezone_name))
    utc_start = local_start.astimezone(UTC).replace(tzinfo=None)
    return utc_start, utc_start + timedelta(days=1)


def as_local(value: datetime, timezone_name: str = DEFAULT_APP_TIMEZONE) -> datetime:
    value_utc = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
    return value_utc.astimezone(app_zone(timezone_name))
