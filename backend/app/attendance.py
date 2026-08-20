import logging
import os
import tempfile
from datetime import datetime, timedelta
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import get_current_user, get_password_hash, verify_password
from .attendance_policy import attendance_status
from .config import Settings, get_settings
from .database import get_db_session
from .exception_service import get_or_create_exception, publish_exception_event, resolve_subject_exceptions
from .models import AttendanceLog, AuditLog, Enterprise, Role, User
from .notifications import notification_hub
from .timezone import local_day_bounds_utc_naive, utc_now_naive
from .schemas import AttendanceVerificationResponse, FaceEnrollmentResponse, PinSetRequest, PinVerifyRequest
from .security import enforce_rate_limit, validate_jpeg_bytes

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/attendance", tags=["attendance"])


async def require_organization_member(current_user: User = Depends(get_current_user)) -> User:
    if current_user.enterprise_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="An organization employee account is required.",
        )
    if current_user.account_status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account is not active.")
    return current_user


def _face_temp_file(content: bytes, settings: Settings) -> str:
    if len(content) > settings.max_evidence_bytes or not validate_jpeg_bytes(content):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="A valid JPEG face capture is required.",
        )

    os.makedirs(settings.evidence_storage_dir, mode=0o700, exist_ok=True)
    handle = tempfile.NamedTemporaryFile(
        prefix="employee-face-",
        suffix=".jpg",
        dir=settings.evidence_storage_dir,
        delete=False,
    )
    try:
        handle.write(content)
        handle.flush()
    finally:
        handle.close()
    return handle.name


def _face_db():
    try:
        from .face_db import has_user_face, register_user_face, verify_user_face

        return register_user_face, verify_user_face, has_user_face
    except Exception as exc:
        logger.exception("Employee facial-recognition engine is unavailable: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Facial verification is temporarily unavailable.",
        ) from exc


async def _read_capture(capture: UploadFile, settings: Settings) -> bytes:
    if capture.content_type not in {"image/jpeg", "image/jpg"}:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only JPEG face captures are accepted.",
        )
    return await capture.read(settings.max_evidence_bytes + 1)


@router.post("/face/enroll", response_model=FaceEnrollmentResponse)
async def enroll_employee_face(
    request: Request,
    capture: Annotated[UploadFile, File(...)],
    current_user: User = Depends(require_organization_member),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
) -> FaceEnrollmentResponse:
    """Enroll or replace the authenticated employee's organization-scoped embedding."""
    enforce_rate_limit(
        request,
        settings,
        scope="face-enrollment",
        account_key=str(current_user.id),
        limit=settings.authenticated_rate_limit_per_account,
    )

    path = None
    try:
        content = await _read_capture(capture, settings)
        path = _face_temp_file(content, settings)
        register_user_face, _, _ = _face_db()
        register_user_face(
            str(current_user.id),
            path,
            enterprise_id=str(current_user.enterprise_id),
        )
        current_user.recognition_status = "enrolled"
        resolved_exceptions = await resolve_subject_exceptions(
            db,
            subject_user_id=current_user.id,
            exception_type="face_enrollment_missing",
            actor_id=current_user.id,
        )
        await db.commit()
        for exception in resolved_exceptions:
            await db.refresh(exception)
            await publish_exception_event(db, exception)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No usable face was detected. Center one face in the frame and try again.",
        ) from exc
    finally:
        await capture.close()
        if path:
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass

    return FaceEnrollmentResponse(status="enrolled", recognition_status="enrolled")


async def _attendance_start_minutes(db: AsyncSession, current_user: User, settings: Settings) -> int:
    enterprise = await db.get(Enterprise, current_user.enterprise_id)
    return getattr(enterprise, "attendance_start_minutes", settings.attendance_late_after_minutes) if enterprise else settings.attendance_late_after_minutes


async def _record_attendance(
    db: AsyncSession,
    current_user: User,
    action: Literal["check-in", "check-out"],
    verification_distance: float,
    method: str,
    late_after_minutes: int,
    timezone_name: str,
) -> AttendanceVerificationResponse:
    # Serialize attendance mutations for this account so simultaneous retries cannot both pass the guard.
    await db.scalar(select(User.id).where(User.id == current_user.id).with_for_update())
    open_entry = await db.scalar(
        select(AttendanceLog)
        .where(AttendanceLog.user_id == current_user.id, AttendanceLog.check_out.is_(None))
        .order_by(AttendanceLog.check_in.desc())
    )
    if action == "check-in":
        today_start, tomorrow_start = local_day_bounds_utc_naive(timezone_name)
        completed_today = await db.scalar(
            select(AttendanceLog.id)
            .where(
                AttendanceLog.user_id == current_user.id,
                AttendanceLog.check_in >= today_start,
                AttendanceLog.check_in < tomorrow_start,
                AttendanceLog.check_out.is_not(None),
            )
            .limit(1)
        )
        if completed_today is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Attendance already recorded for today.")
        if open_entry is None:
            open_entry = AttendanceLog(
                user_id=current_user.id,
                status=attendance_status(utc_now_naive(), late_after_minutes, timezone_name),
            )
            db.add(open_entry)
            already_recorded = False
        else:
            already_recorded = True
    else:
        if open_entry is None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No open check-in was found for this employee.")
        open_entry.check_out = utc_now_naive()
        already_recorded = False

    await db.commit()
    await db.refresh(open_entry)
    if method == "PIN":
        exception, created = await get_or_create_exception(
            db,
            enterprise_id=current_user.enterprise_id,
            subject_user_id=current_user.id,
            attendance_id=open_entry.id,
            exception_type="pin_fallback_used",
            severity="low",
            title="PIN fallback used",
            message=f"{current_user.name} recorded attendance using PIN fallback.",
            source_key=f"pin-fallback:{open_entry.id}",
        )
        if created:
            await db.commit()
            await db.refresh(exception)
            await publish_exception_event(db, exception)
    await notification_hub.publish(
        str(current_user.id),
        "attendance.verified",
        "Attendance verified",
        f"Your {method} was verified and attendance was updated.",
        attendance_id=str(open_entry.id),
        user_id=str(open_entry.user_id),
        action=action,
        check_in=open_entry.check_in.isoformat(),
        check_out=open_entry.check_out.isoformat() if open_entry.check_out else None,
        attendance_status=open_entry.status,
        already_recorded=already_recorded,
        verification_method=method,
    )
    return AttendanceVerificationResponse(
        status="verified",
        action=action,
        attendance_id=open_entry.id,
        user_id=current_user.id,
        face_distance=verification_distance,
        check_in=open_entry.check_in,
        check_out=open_entry.check_out,
        attendance_status=open_entry.status,
        already_recorded=already_recorded,
    )


@router.post("/pin", status_code=status.HTTP_204_NO_CONTENT)
async def set_attendance_pin(
    request: Request,
    payload: PinSetRequest,
    current_user: User = Depends(require_organization_member),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    enforce_rate_limit(request, settings, scope="pin-setup", account_key=str(current_user.id), limit=settings.authenticated_rate_limit_per_account)
    current_user.pin_hash = get_password_hash(payload.pin)
    await db.commit()


@router.post("/pin/verify", response_model=AttendanceVerificationResponse)
async def verify_pin_attendance(
    request: Request,
    payload: PinVerifyRequest,
    current_user: User = Depends(require_organization_member),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
) -> AttendanceVerificationResponse:
    enforce_rate_limit(request, settings, scope="pin-verification", account_key=str(current_user.id), limit=settings.pin_rate_limit_per_account)
    if not current_user.pin_hash:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Set an attendance PIN before using PIN fallback.")
    try:
        pin_matches = verify_password(payload.pin, current_user.pin_hash)
    except Exception:
        logger.exception("PIN hash verification failed for user %s", current_user.id)
        pin_matches = False
    if not pin_matches:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="PIN verification failed.")
    start_minutes = await _attendance_start_minutes(db, current_user, settings)
    return await _record_attendance(
        db,
        current_user,
        payload.action,
        0.0,
        "PIN",
        start_minutes,
        settings.app_timezone,
    )


@router.post("/verify", response_model=AttendanceVerificationResponse)
async def verify_employee_attendance(
    request: Request,
    action: Annotated[Literal["check-in", "check-out"], Form(...)],
    capture: Annotated[UploadFile, File(...)],
    current_user: User = Depends(require_organization_member),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
) -> AttendanceVerificationResponse:
    """Verify the authenticated user's face, then create or close one attendance log."""
    enforce_rate_limit(
        request,
        settings,
        scope="face-verification",
        account_key=str(current_user.id),
        limit=settings.authenticated_rate_limit_per_account,
    )

    if current_user.recognition_status != "enrolled":
        exception, created = await get_or_create_exception(
            db,
            enterprise_id=current_user.enterprise_id,
            subject_user_id=current_user.id,
            exception_type="face_enrollment_missing",
            severity="high",
            title="Face enrollment required",
            message=f"{current_user.name} needs to enroll an attendance face before recording attendance.",
            source_key=f"face-enrollment-missing:{current_user.id}",
        )
        if created:
            await db.commit()
            await db.refresh(exception)
            await publish_exception_event(db, exception)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Enroll your face before recording attendance.",
        )

    path = None
    try:
        content = await _read_capture(capture, settings)
        path = _face_temp_file(content, settings)
        _, verify_user_face, has_user_face = _face_db()
        if not has_user_face(str(current_user.id)):
            logger.warning(
                "Face enrollment missing from biometric store user_id=%s enterprise_id=%s",
                current_user.id,
                current_user.enterprise_id,
            )
            exception, created = await get_or_create_exception(
                db,
                enterprise_id=current_user.enterprise_id,
                subject_user_id=current_user.id,
                exception_type="face_enrollment_missing",
                severity="high",
                title="Face enrollment unavailable",
                message=f"{current_user.name}'s attendance face enrollment is unavailable and needs to be captured again.",
                source_key=f"face-enrollment-missing:{current_user.id}",
            )
            if created:
                await db.commit()
                await db.refresh(exception)
                await publish_exception_event(db, exception)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Your attendance face enrollment is unavailable. Re-enroll your face before recording attendance.",
            )
        matched_user_id, distance = verify_user_face(
            path,
            threshold=settings.employee_face_threshold,
            enterprise_id=str(current_user.enterprise_id),
            user_id=str(current_user.id),
        )
    except ValueError as exc:
        logger.info(
            "Face verification rejected during extraction user_id=%s enterprise_id=%s reason=%s",
            current_user.id,
            current_user.enterprise_id,
            str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No usable face was detected. Center one face in the frame and try again.",
        ) from exc
    finally:
        await capture.close()
        if path:
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass

    if matched_user_id != str(current_user.id) or distance is None:
        logger.info(
            "Face verification rejected by match user_id=%s enterprise_id=%s matched_user_id=%s distance=%s threshold=%s",
            current_user.id,
            current_user.enterprise_id,
            matched_user_id,
            distance,
            settings.employee_face_threshold,
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Face verification failed. Try again with the enrolled employee centered in the frame.",
        )

    start_minutes = await _attendance_start_minutes(db, current_user, settings)
    return await _record_attendance(
        db,
        current_user,
        action,
        float(distance),
        "face",
        start_minutes,
        settings.app_timezone,
    )
