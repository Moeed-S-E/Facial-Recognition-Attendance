import asyncio
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import get_password_hash
from .database import async_session_maker, initialize_database
from .models import AttendanceLog, Enterprise, Role, Team, User

DEMO_ENTERPRISE_ID = UUID("11111111-1111-1111-1111-111111111111")
DEMO_TEAM_PEOPLE_ID = UUID("22222222-2222-2222-2222-222222222222")
DEMO_TEAM_CUSTOMER_SUCCESS_ID = UUID("33333333-3333-3333-3333-333333333333")
DEMO_USER_OWNER_ID = UUID("44444444-4444-4444-4444-444444444444")
DEMO_USER_HR_ID = UUID("55555555-5555-5555-5555-555555555555")
DEMO_USER_MANAGER_ID = UUID("66666666-6666-6666-6666-666666666666")
DEMO_USER_EMPLOYEE_ID = UUID("77777777-7777-7777-7777-777777777777")
DEMO_PASSWORD = "DemoSecure2026!"

ROLE_LABELS = {
    Role.ENTERPRISE_ADMIN: "Organization owner",
    Role.ENTERPRISE_ADMIN: "Organization admin",
    Role.HR: "HR",
    Role.MANAGER: "Manager",
    Role.EMPLOYEE: "Employee",
}


async def seed_demo_data(session: AsyncSession) -> list[User]:
    """Insert the demo organization graph once and return its four accounts."""

    enterprise = await session.get(Enterprise, DEMO_ENTERPRISE_ID)
    if enterprise is None:
        enterprise = Enterprise(
            id=DEMO_ENTERPRISE_ID,
            name="Northstar Labs",
        )
        session.add(enterprise)

    teams_by_id = {
        DEMO_TEAM_PEOPLE_ID: ("People & HR", DEMO_USER_HR_ID),
        DEMO_TEAM_CUSTOMER_SUCCESS_ID: ("Customer Success", DEMO_USER_MANAGER_ID),
    }
    for team_id, (team_name, _) in teams_by_id.items():
        team = await session.get(Team, team_id)
        if team is None:
            session.add(Team(id=team_id, enterprise_id=DEMO_ENTERPRISE_ID, name=team_name))

    accounts = [
        (DEMO_USER_OWNER_ID, "Avery Morgan", "owner@northstarlabs.com", Role.ENTERPRISE_ADMIN, None, "enrolled"),
        (DEMO_USER_HR_ID, "Priya Shah", "hr@northstarlabs.com", Role.HR, DEMO_TEAM_PEOPLE_ID, "enrolled"),
        (DEMO_USER_MANAGER_ID, "Jordan Bell", "manager@northstarlabs.com", Role.MANAGER, DEMO_TEAM_CUSTOMER_SUCCESS_ID, "enrolled"),
        (DEMO_USER_EMPLOYEE_ID, "Noah Williams", "employee@northstarlabs.com", Role.EMPLOYEE, DEMO_TEAM_CUSTOMER_SUCCESS_ID, "enrolled"),
    ]

    users: list[User] = []
    for user_id, name, email, role, team_id, recognition_status in accounts:
        user = await session.get(User, user_id)
        if user is None:
            user = User(
                id=user_id,
                enterprise_id=DEMO_ENTERPRISE_ID,
                team_id=team_id,
                name=name,
                email=email,
                hashed_password=get_password_hash(DEMO_PASSWORD),
                role=role,
                account_status="active",
                recognition_status=recognition_status,
            )
            session.add(user)
        else:
            user.enterprise_id = DEMO_ENTERPRISE_ID
            user.team_id = team_id
            user.name = name
            user.email = email
            user.hashed_password = get_password_hash(DEMO_PASSWORD)
            user.role = role
            user.account_status = "active"
            user.recognition_status = recognition_status
        users.append(user)

    await session.flush()

    now = datetime.utcnow().replace(second=0, microsecond=0)

    existing_attendance = await session.scalar(
        select(AttendanceLog).where(AttendanceLog.user_id == DEMO_USER_EMPLOYEE_ID).limit(1)
    )
    if existing_attendance is None:
        session.add(
            AttendanceLog(
                user_id=DEMO_USER_EMPLOYEE_ID,
                check_in=now - timedelta(hours=3, minutes=12),
                check_out=now - timedelta(minutes=22),
                status="Present",
            )
        )

    await session.commit()
    return users


async def run_seed() -> None:
    await initialize_database()
    async with async_session_maker() as session:
        users = await seed_demo_data(session)
        print(f"Seeded {len(users)} demo accounts in Northstar Labs.")
        for user in users:
            print(f"- {user.role.value}: {user.email}")


if __name__ == "__main__":
    asyncio.run(run_seed())
