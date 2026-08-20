from fastapi import APIRouter, Depends, Path, Request
from fastapi import APIRouter, Depends, Path, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .cache import cache_delete, cache_get_json, cache_set_json
from .config import Settings, get_settings
from .database import get_db_session
from .models import AttendanceLog, Enterprise, Role, Team, User
from .notifications import notification_hub, valid_notification_user_id
from .schemas import (
    AccountResponse,
    AttendancePolicyResponse,
    AttendanceResponse,
    LeavePolicyResponse,
    DirectoryResponse,
    OrganizationResponse,
    SeedResponse,
    TeamResponse,
)
from .security import enforce_rate_limit, require_development_demo
from .seed import DEMO_ENTERPRISE_ID, ROLE_LABELS, seed_demo_data

router = APIRouter(prefix="/v1/demo", tags=["demo"])


class DemoNotificationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    event_type: str = Field(default="demo.notification", min_length=1, max_length=80, pattern=r"^[A-Za-z0-9._:-]+$")
    title: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=500)


def account_response(user: User) -> AccountResponse:
    return AccountResponse(
        id=user.id,
        enterprise_id=user.enterprise_id,
        team_id=user.team_id,
        name=user.name,
        email=user.email,
        role=user.role.value,
        role_label=ROLE_LABELS[user.role],
        account_status=user.account_status,
        recognition_status=user.recognition_status,
        profile_image_url=f"/v1/auth/profile-image/{user.id}" if user.profile_image_path else None,
        created_at=user.created_at,
    )


async def fetch_directory(db: AsyncSession) -> DirectoryResponse:
    enterprise = await db.get(Enterprise, DEMO_ENTERPRISE_ID)
    if enterprise is None:
        await seed_demo_data(db)
        enterprise = await db.get(Enterprise, DEMO_ENTERPRISE_ID)

    users = list(
        (await db.scalars(select(User).where(User.enterprise_id == DEMO_ENTERPRISE_ID).order_by(User.created_at))).all()
    )
    teams = list(
        (await db.scalars(select(Team).where(Team.enterprise_id == DEMO_ENTERPRISE_ID).order_by(Team.name))).all()
    )
    attendance = list(
        (
            await db.scalars(
                select(AttendanceLog)
                .join(User, AttendanceLog.user_id == User.id)
                .where(User.enterprise_id == DEMO_ENTERPRISE_ID)
                .order_by(AttendanceLog.check_in.desc())
            )
        ).all()
    )

    owner = next((user for user in users if user.role == Role.ENTERPRISE_ADMIN), users[0])
    manager_by_team = {user.team_id: user.name for user in users if user.role == Role.MANAGER and user.team_id}

    return DirectoryResponse(
        organization=OrganizationResponse(
            id=enterprise.id,
            name=enterprise.name,
            account_owner_id=owner.id,
            account_owner_name=owner.name,
            account_owner_email=owner.email,
            users_count=len(users),
            teams_count=len(teams),
            created_at=enterprise.created_at,
        ),
        accounts=[account_response(user) for user in users],
        teams=[TeamResponse(id=team.id, name=team.name, manager_name=manager_by_team.get(team.id)) for team in teams],
        attendance=[
            AttendanceResponse(
                id=entry.id,
                user_id=entry.user_id,
                check_in=entry.check_in,
                check_out=entry.check_out,
                status=entry.status,
            )
            for entry in attendance
        ],
        leave_policy=LeavePolicyResponse(annual_days=12, medical_days=8),
    )


@router.post("/seed", response_model=SeedResponse)
async def seed_demo_accounts(
    request: Request,
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
) -> SeedResponse:
    require_development_demo(request, settings)
    users = await seed_demo_data(db)
    await cache_delete("demo:directory", settings)
    return SeedResponse(
        seeded=True,
        organization_id=DEMO_ENTERPRISE_ID,
        accounts_created=len(users),
        accounts=[account_response(user) for user in users],
    )


@router.post("/notifications/{user_id}")
async def send_demo_notification(
    request: Request,
    payload: DemoNotificationRequest,
    user_id: str = Path(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9._:@+-]+$"),
    settings: Settings = Depends(get_settings),
) -> dict[str, int | bool]:
    require_development_demo(request, settings)
    if not valid_notification_user_id(user_id):
        return {"sent": False, "delivered": 0}
    delivered = await notification_hub.publish(user_id, payload.event_type, payload.title, payload.message)
    return {"sent": True, "delivered": delivered}


@router.get("/directory", response_model=DirectoryResponse)
async def get_demo_directory(
    request: Request,
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
) -> DirectoryResponse:
    """Return seeded sample data for the public, read-only demo workspace."""

    enforce_rate_limit(request, settings, scope="demo-directory", limit=settings.demo_rate_limit_per_ip)
    cached = await cache_get_json("demo:directory", settings)
    if cached:
        return DirectoryResponse.model_validate_json(cached)
    directory = await fetch_directory(db)
    await cache_set_json("demo:directory", directory.model_dump_json(), settings)
    return directory
