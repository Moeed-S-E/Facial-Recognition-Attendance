from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import AttendanceException, Role, User
from .notifications import notification_hub

REVIEW_ROLES = {Role.ENTERPRISE_ADMIN, Role.HR, Role.MANAGER}


async def get_or_create_exception(
    db: AsyncSession,
    *,
    enterprise_id: UUID,
    subject_user_id: UUID,
    exception_type: str,
    severity: str,
    title: str,
    message: str,
    source_key: str,
    attendance_id: UUID | None = None,
) -> tuple[AttendanceException, bool]:
    existing = await db.scalar(select(AttendanceException).where(AttendanceException.source_key == source_key))
    if existing is not None:
        return existing, False
    item = AttendanceException(
        enterprise_id=enterprise_id,
        subject_user_id=subject_user_id,
        attendance_id=attendance_id,
        exception_type=exception_type,
        severity=severity,
        title=title,
        message=message,
        source_key=source_key,
    )
    db.add(item)
    await db.flush()
    return item, True


async def publish_exception_event(db: AsyncSession, item: AttendanceException) -> None:
    recipient_ids = set(
        str(user_id)
        for user_id in (
            await db.scalars(
                select(User.id).where(
                    User.enterprise_id == item.enterprise_id,
                    User.role.in_(REVIEW_ROLES),
                )
            )
        ).all()
    )
    recipient_ids.add(str(item.subject_user_id))
    for recipient_id in recipient_ids:
        await notification_hub.publish(
            recipient_id,
            "attendance.exception",
            item.title,
            item.message,
            exception_id=str(item.id),
            exception_type=item.exception_type,
            severity=item.severity,
            exception_status=item.status,
            subject_user_id=str(item.subject_user_id),
            action_url=f"/app/exceptions?exception={item.id}",
            created_at=item.created_at.isoformat() if item.created_at else datetime.utcnow().isoformat(),
        )


async def resolve_subject_exceptions(
    db: AsyncSession,
    *,
    subject_user_id: UUID,
    exception_type: str,
    actor_id: UUID,
) -> list[AttendanceException]:
    items = list(
        (
            await db.scalars(
                select(AttendanceException).where(
                    AttendanceException.subject_user_id == subject_user_id,
                    AttendanceException.exception_type == exception_type,
                    AttendanceException.status != "resolved",
                )
            )
        ).all()
    )
    now = datetime.utcnow()
    for item in items:
        item.status = "resolved"
        item.acknowledged_at = item.acknowledged_at or now
        item.acknowledged_by_id = item.acknowledged_by_id or actor_id
        item.resolved_at = now
        item.resolved_by_id = actor_id
    return items


async def publish_exception_update(db: AsyncSession, item: AttendanceException) -> None:
    await publish_exception_event(db, item)
