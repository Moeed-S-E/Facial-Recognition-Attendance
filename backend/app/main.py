from collections.abc import AsyncIterator
import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import Settings, get_settings
from .analytics_ai import train_models_if_ready
from .database import async_session_maker, initialize_database
from .schemas import ConsentDeclaration, ConsentDecision, EvidenceReceipt, HealthStatus
from .notifications import notification_hub, notification_token_is_valid, valid_notification_user_id
from .security import enforce_rate_limit, enforce_websocket_rate_limit, validate_jpeg_bytes
from .storage import StorageConfigurationError, upload_evidence

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg"}


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Initialize the schema and run the daily analytics readiness check."""

    runtime_settings = get_settings()
    logger.info("Starting up Facial Recognition Attendance API...")
    await initialize_database()

    async def train_when_ready() -> None:
        while True:
            try:
                async with async_session_maker() as db:
                    result = await train_models_if_ready(db, runtime_settings.analytics_min_data_days)
                    if result["status"] == "trained":
                        logger.info("Regression/classification analytics training completed")
            except Exception:
                logger.exception("Analytics model training check failed")
            await asyncio.sleep(runtime_settings.analytics_training_interval_seconds)

    training_task = asyncio.create_task(train_when_ready())
    try:
        yield
    finally:
        training_task.cancel()
        with suppress(asyncio.CancelledError):
            await training_task
        logger.info("Shutting down Facial Recognition Attendance API...")


def create_app(settings: Settings | None = None) -> FastAPI:
    runtime_settings = settings or get_settings()
    app = FastAPI(title=runtime_settings.app_name, version="0.2.0", lifespan=lifespan)

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, _error: Exception) -> JSONResponse:
        logger.exception("Unhandled API error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An internal error occurred."},
        )

    configured_origins = [origin.strip().rstrip("/") for origin in runtime_settings.cors_allowed_origins if origin.strip()]
    allowed_origins = list(dict.fromkeys(configured_origins))

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Accept",
            "Content-Type",
            "Authorization",
        ],
    )

    from .attendance import router as attendance_router
    from .auth import router as auth_router
    from .demo import router as demo_router
    from .organization import router as organization_router

    app.include_router(auth_router)
    app.include_router(attendance_router)
    app.include_router(demo_router)
    app.include_router(organization_router)

    @app.websocket(runtime_settings.notification_ws_path)
    async def notification_socket(websocket: WebSocket) -> None:
        """Stream user-scoped notifications over the configured websocket path."""

        if not runtime_settings.notifications_enabled:
            await websocket.close(code=1008, reason="Realtime notifications are disabled.")
            return

        user_id = websocket.query_params.get("user_id", "")
        retry_after = enforce_websocket_rate_limit(websocket, runtime_settings, account_key=user_id or None)
        if retry_after is not None:
            await websocket.close(code=1013, reason=f"Too many connection attempts. Retry after {retry_after} seconds.")
            return
        if not valid_notification_user_id(user_id) or not notification_token_is_valid(websocket, runtime_settings, user_id):

            await websocket.close(code=1008, reason="Notification authentication required.")
            return

        await notification_hub.connect(user_id, websocket)
        try:
            await websocket.send_json({
                "type": "connection.ready",
                "title": "Realtime notifications connected",
                "message": "Facial Recognition Attendance is listening for updates.",
            })
            while True:
                # The client sends a small heartbeat so dead browser tabs are
                # removed promptly by the server and reverse proxy.
                await websocket.receive_text()
        except WebSocketDisconnect:
            pass
        except Exception:
            logger.exception("Realtime notification socket failed for user %s", user_id)
        finally:
            await notification_hub.disconnect(user_id, websocket)

    @app.get("/health", response_model=HealthStatus, tags=["operational"])
    async def health(request: Request) -> HealthStatus:
        enforce_rate_limit(request, runtime_settings, scope="health", limit=runtime_settings.public_rate_limit_per_ip)
        return HealthStatus(retention_mode=runtime_settings.attendance_retention_mode)

    @app.post("/v1/attendance/consent", response_model=ConsentDecision, tags=["attendance"])
    async def declare_consent(request: Request, declaration: ConsentDeclaration) -> ConsentDecision:
        """Return the storage decision without retaining a capture or biometric template."""

        enforce_rate_limit(
            request,
            runtime_settings,
            scope="attendance",
            account_key=declaration.employee_id,
            limit=runtime_settings.public_rate_limit_per_ip,
        )
        approved = (
            runtime_settings.attendance_retention_mode == "approved-evidence"
            and declaration.retention_mode == "approved-evidence"
            and declaration.local_processing_acknowledged
            and declaration.server_retention_authorized
        )
        message = (
            "Server-side evidence may be submitted through the protected evidence endpoint."
            if approved
            else "Keep the capture on-device only and delete it after the local quality check."
        )
        return ConsentDecision(
            attendance_id=declaration.attendance_id,
            retention_mode="approved-evidence" if approved else "local-only",
            evidence_upload_permitted=approved,
            message=message,
        )

    @app.post("/v1/attendance/evidence", response_model=EvidenceReceipt, tags=["attendance"])
    async def submit_evidence(
        request: Request,
        attendance_id: Annotated[UUID, Form()],
        employee_id: Annotated[str, Form(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9._:@+-]+$")],
        consent_id: Annotated[UUID, Form()],
        evidence: Annotated[UploadFile, File()],
    ) -> EvidenceReceipt:
        """Accept explicitly approved JPEG evidence without exposing local paths."""

        del consent_id  # Reserved for a verified consent-ledger lookup.
        enforce_rate_limit(
            request,
            runtime_settings,
            scope="attendance-upload",
            account_key=employee_id,
            limit=runtime_settings.authenticated_rate_limit_per_account,
        )

        if runtime_settings.attendance_retention_mode != "approved-evidence":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This environment is configured for local-only attendance capture.",
            )

        if evidence.content_type not in ALLOWED_IMAGE_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Only JPEG evidence is accepted.",
            )

        try:
            content = await evidence.read(runtime_settings.max_evidence_bytes + 1)
            if len(content) > runtime_settings.max_evidence_bytes:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="Evidence exceeds the configured maximum size.",
                )
            if not validate_jpeg_bytes(content):
                raise HTTPException(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    detail="The uploaded file is not a valid JPEG image.",
                )

            object_path = upload_evidence(
                runtime_settings,
                employee_id=employee_id,
                attendance_id=attendance_id,
                content=content,
                content_type="image/jpeg",
            )
            await notification_hub.publish(
                employee_id,
                "attendance.evidence.accepted",
                "Attendance capture accepted",
                "Your attendance evidence was accepted by the configured backend.",
                attendance_id=str(attendance_id),
            )
        except StorageConfigurationError as error:
            logger.exception("Evidence storage is unavailable: %s", error)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Evidence storage is temporarily unavailable.",
            ) from error
        except HTTPException:
            raise
        except Exception as error:
            logger.exception("Unexpected evidence upload failure: %s", error)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Evidence could not be processed.",
            ) from error
        finally:
            await evidence.close()

        return EvidenceReceipt(
            object_path=object_path,
            storage_backend="local-private-filesystem",
            content_type="image/jpeg",
            size_bytes=len(content),
        )

    return app


app = create_app()

__all__ = ["app", "create_app"]
