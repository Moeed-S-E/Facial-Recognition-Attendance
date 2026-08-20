from datetime import datetime

from .timezone import DEFAULT_APP_TIMEZONE, as_local

DEFAULT_LATE_AFTER_MINUTES = 9 * 60


def parse_start_time(value: str) -> int:
    hour, minute = (int(part) for part in value.split(":", 1))
    if not 0 <= hour <= 23 or not 0 <= minute <= 59:
        raise ValueError("start_time must be a valid 24-hour time")
    return hour * 60 + minute


def format_start_time(minutes: int) -> str:
    if not 0 <= minutes <= 23 * 60 + 59:
        raise ValueError("attendance start time is outside the valid day")
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def attendance_status(
    check_in: datetime,
    late_after_minutes: int = DEFAULT_LATE_AFTER_MINUTES,
    timezone_name: str = DEFAULT_APP_TIMEZONE,
) -> str:
    """Return the policy status using the configured local clock."""
    local_check_in = as_local(check_in, timezone_name)
    minutes = local_check_in.hour * 60 + local_check_in.minute
    return "Late" if minutes >= late_after_minutes else "Present"
