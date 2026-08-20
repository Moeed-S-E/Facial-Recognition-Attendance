from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from .attendance_policy import attendance_status, format_start_time, parse_start_time
from .auth import get_current_user, get_password_hash
from .config import Settings, get_settings
from .database import get_db_session
from .exception_service import REVIEW_ROLES, get_or_create_exception, publish_exception_event
from .models import AttendanceException, AttendanceLog, AuditLog, Enterprise, LeaveRequest, Role, Team, TeamAssignmentRequest, User
from .schemas import (
    AccountResponse,
    AttendanceExceptionResponse,
    AttendanceExceptionReview,
    AttendancePolicyResponse,
    AttendancePolicyUpdate,
    AttendanceResponse,
    LeavePolicyResponse,
    LeavePolicyUpdate,
    LeaveRequestCreate,
    LeaveRequestResponse,
    DirectoryResponse,
    OrganizationAccountCreate,
    OrganizationResponse,
    RoleUpdate,
    SelfAttendanceResponse,
    TeamAssignmentDirect,
    TeamAssignmentRequestCreate,
    TeamAssignmentRequestResponse,
    TeamCreate,
    TeamResponse,
)
from .seed import ROLE_LABELS
from .timezone import local_day_bounds_utc_naive, utc_now_naive

router = APIRouter(prefix="/v1/organization", tags=["organization"])

OWNER_ROLES = {Role.ENTERPRISE_ADMIN}
ACCOUNT_ADMIN_ROLES = OWNER_ROLES | {Role.HR}
ASSIGNMENT_REVIEW_ROLES = ACCOUNT_ADMIN_ROLES
POLICY_EDIT_ROLES = OWNER_ROLES | {Role.HR, Role.MANAGER}
LEAVE_POLICY_EDIT_ROLES = OWNER_ROLES | {Role.HR}


def account_response(user: User) -> AccountResponse:
    return AccountResponse(
        id=user.id,
        enterprise_id=user.enterprise_id,
        team_id=user.team_id,
        name=user.name,
        email=user.email,
        employee_id=user.employee_id,
        department=user.department,
        role=user.role.value,
        role_label=ROLE_LABELS[user.role],
        account_status=user.account_status,
        recognition_status=user.recognition_status,
        profile_image_url=f"/v1/auth/profile-image/{user.id}" if user.profile_image_path else None,
        created_at=user.created_at,
    )


def require_org_user(current_user: User) -> UUID:
    if current_user.enterprise_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="An organization account is required.")
    return current_user.enterprise_id


def ensure_same_org(target: User, enterprise_id: UUID) -> None:
    if target.enterprise_id != enterprise_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found in this organization.")


async def get_team(db: AsyncSession, team_id: UUID, enterprise_id: UUID) -> Team:
    team = await db.scalar(select(Team).where(Team.id == team_id, Team.enterprise_id == enterprise_id))
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found in this organization.")
    return team


async def get_employee(db: AsyncSession, user_id: UUID, enterprise_id: UUID) -> User:
    employee = await db.scalar(select(User).where(User.id == user_id, User.enterprise_id == enterprise_id))
    if employee is None or employee.role != Role.EMPLOYEE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee account not found in this organization.")
    return employee


async def request_response(db: AsyncSession, item: TeamAssignmentRequest) -> TeamAssignmentRequestResponse:
    employee = await db.get(User, item.employee_id)
    team = await db.get(Team, item.team_id)
    requester = await db.get(User, item.requested_by_id)
    if employee is None or team is None or requester is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Assignment request data is unavailable.")
    return TeamAssignmentRequestResponse(
        id=item.id,
        employee_id=employee.id,
        employee_name=employee.name,
        employee_email=employee.email,
        team_id=team.id,
        team_name=team.name,
        requested_by_name=requester.name,
        status=item.status,
        created_at=item.created_at,
    )


async def leave_response(db: AsyncSession, item: LeaveRequest) -> LeaveRequestResponse:
    requester = await db.get(User, item.requester_id)
    reviewer = await db.get(User, item.reviewed_by_id) if item.reviewed_by_id else None
    if requester is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Leave request data is unavailable.")
    return LeaveRequestResponse(
        id=item.id,
        requester_id=item.requester_id,
        requester_name=requester.name,
        leave_type=item.leave_type,
        start_date=item.start_date,
        end_date=item.end_date,
        note=item.note,
        status=item.status,
        reviewed_by_name=reviewer.name if reviewer else None,
        created_at=item.created_at,
    )


@router.post("/leave-requests", response_model=LeaveRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_leave_request(
    payload: LeaveRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> LeaveRequestResponse:
    enterprise_id = require_org_user(current_user)
    if payload.client_request_id:
        existing = await db.scalar(
            select(LeaveRequest).where(LeaveRequest.client_request_id == payload.client_request_id)
        )
        if existing:
            if existing.requester_id != current_user.id:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That client request identifier is already in use.")
            return await leave_response(db, existing)
    item = LeaveRequest(
        enterprise_id=enterprise_id,
        requester_id=current_user.id,
        client_request_id=payload.client_request_id,
        leave_type=payload.leave_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        note=payload.note,
    )
    db.add(item)
    await db.flush()
    db.add(AuditLog(actor_id=current_user.id, action="organization.leave_requested", target_id=str(item.id), details={"leave_type": item.leave_type}))
    await db.commit()
    await db.refresh(item)
    return await leave_response(db, item)


@router.get("/leave-requests", response_model=list[LeaveRequestResponse])
async def list_leave_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[LeaveRequestResponse]:
    enterprise_id = require_org_user(current_user)
    query = select(LeaveRequest).where(LeaveRequest.enterprise_id == enterprise_id)
    if current_user.role in ACCOUNT_ADMIN_ROLES:
        pass
    elif current_user.role == Role.MANAGER and current_user.team_id is not None:
        query = query.join(User, User.id == LeaveRequest.requester_id).where(User.team_id == current_user.team_id)
    else:
        query = query.where(LeaveRequest.requester_id == current_user.id)
    items = list((await db.scalars(query.order_by(LeaveRequest.created_at.desc()))).all())
    return [await leave_response(db, item) for item in items]


async def review_leave_request(request_id: UUID, decision: str, current_user: User, db: AsyncSession) -> LeaveRequestResponse:
    enterprise_id = require_org_user(current_user)
    item = await db.scalar(select(LeaveRequest).where(LeaveRequest.id == request_id, LeaveRequest.enterprise_id == enterprise_id))
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found.")
    if item.status != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This leave request has already been reviewed.")
    requester = await db.get(User, item.requester_id)
    if requester is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave requester not found.")
    if current_user.role not in ACCOUNT_ADMIN_ROLES and not (current_user.role == Role.MANAGER and requester.team_id == current_user.team_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot review this leave request.")
    item.status = decision
    item.reviewed_by_id = current_user.id
    item.reviewed_at = utc_now_naive()
    db.add(AuditLog(actor_id=current_user.id, action=f"organization.leave_{decision}", target_id=str(item.id), details={"requester_id": str(item.requester_id)}))
    await db.commit()
    await db.refresh(item)
    return await leave_response(db, item)


@router.post("/leave-requests/{request_id}/approve", response_model=LeaveRequestResponse)
async def approve_leave_request(request_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_session)) -> LeaveRequestResponse:
    return await review_leave_request(request_id, "approved", current_user, db)


@router.post("/leave-requests/{request_id}/reject", response_model=LeaveRequestResponse)
async def reject_leave_request(request_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_session)) -> LeaveRequestResponse:
    return await review_leave_request(request_id, "rejected", current_user, db)


@router.get("/leave-policy", response_model=LeavePolicyResponse)
async def get_leave_policy(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> LeavePolicyResponse:
    enterprise_id = require_org_user(current_user)
    enterprise = await db.get(Enterprise, enterprise_id)
    if enterprise is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    return LeavePolicyResponse(
        annual_days=getattr(enterprise, "annual_leave_days", 12),
        medical_days=getattr(enterprise, "medical_leave_days", 8),
    )


@router.put("/leave-policy", response_model=LeavePolicyResponse)
async def update_leave_policy(
    payload: LeavePolicyUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> LeavePolicyResponse:
    enterprise_id = require_org_user(current_user)
    if current_user.role not in LEAVE_POLICY_EDIT_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the organization owner or HR can change leave allowances.")
    enterprise = await db.get(Enterprise, enterprise_id)
    if enterprise is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    enterprise.annual_leave_days = payload.annual_days
    enterprise.medical_leave_days = payload.medical_days
    db.add(AuditLog(actor_id=current_user.id, action="organization.leave_policy_updated", target_id=str(enterprise.id), details={"annual_days": payload.annual_days, "medical_days": payload.medical_days}))
    await db.commit()
    await db.refresh(enterprise)
    return LeavePolicyResponse(annual_days=enterprise.annual_leave_days, medical_days=enterprise.medical_leave_days)


@router.get("/attendance-policy", response_model=AttendancePolicyResponse)
async def get_attendance_policy(
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
) -> AttendancePolicyResponse:
    enterprise_id = require_org_user(current_user)
    enterprise = await db.get(Enterprise, enterprise_id)
    if enterprise is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    start_minutes = getattr(enterprise, "attendance_start_minutes", settings.attendance_late_after_minutes)
    return AttendancePolicyResponse(
        start_time=format_start_time(start_minutes),
        start_minutes=start_minutes,
        timezone=settings.app_timezone,
    )


@router.put("/attendance-policy", response_model=AttendancePolicyResponse)
async def update_attendance_policy(
    payload: AttendancePolicyUpdate,
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
) -> AttendancePolicyResponse:
    enterprise_id = require_org_user(current_user)
    if current_user.role not in POLICY_EDIT_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only organization management roles can change attendance time.")
    enterprise = await db.get(Enterprise, enterprise_id)
    if enterprise is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    start_minutes = parse_start_time(payload.start_time)
    enterprise.attendance_start_minutes = start_minutes
    db.add(AuditLog(actor_id=current_user.id, action="organization.attendance_policy_updated", target_id=str(enterprise.id), details={"start_time": payload.start_time, "timezone": settings.app_timezone}))
    await db.commit()
    await db.refresh(enterprise)
    return AttendancePolicyResponse(start_time=format_start_time(start_minutes), start_minutes=start_minutes, timezone=settings.app_timezone)


@router.get("/directory", response_model=DirectoryResponse)
async def get_organization_directory(
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
) -> DirectoryResponse:
    """Return only the organization data allowed by the caller's role."""

    enterprise_id = require_org_user(current_user)
    enterprise = await db.get(Enterprise, enterprise_id)
    if enterprise is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    start_minutes = getattr(enterprise, "attendance_start_minutes", settings.attendance_late_after_minutes)

    all_users = list((await db.scalars(select(User).where(User.enterprise_id == enterprise.id, User.account_status != "removed").order_by(User.created_at))).all())
    all_teams = list((await db.scalars(select(Team).where(Team.enterprise_id == enterprise.id).order_by(Team.name))).all())

    if current_user.role in ACCOUNT_ADMIN_ROLES:
        visible_users = all_users
    elif current_user.role == Role.MANAGER:
        visible_users = [user for user in all_users if user.id == current_user.id or (current_user.team_id is not None and user.team_id == current_user.team_id)]
    else:
        visible_users = [user for user in all_users if user.id == current_user.id]

    visible_user_ids = {user.id for user in visible_users}
    visible_team_ids = {user.team_id for user in visible_users if user.team_id is not None}
    visible_teams = [team for team in all_teams if team.id in visible_team_ids]
    attendance = list((await db.scalars(select(AttendanceLog).where(AttendanceLog.user_id.in_(visible_user_ids)).order_by(AttendanceLog.check_in.desc()))).all()) if visible_user_ids else []
    today_start, tomorrow_start = local_day_bounds_utc_naive(settings.app_timezone)
    self_attendance = await db.scalar(
        select(AttendanceLog)
        .where(
            AttendanceLog.user_id == current_user.id,
            AttendanceLog.check_in >= today_start,
            AttendanceLog.check_in < tomorrow_start,
        )
        .order_by(AttendanceLog.check_in.desc())
    )
    open_attendance = await db.scalar(
        select(AttendanceLog)
        .where(
            AttendanceLog.user_id == current_user.id,
            AttendanceLog.check_out.is_(None),
        )
        .order_by(AttendanceLog.check_in.desc())
    )
    owner = next((user for user in all_users if user.role in OWNER_ROLES), current_user)
    manager_by_team = {user.team_id: user.name for user in all_users if user.role == Role.MANAGER and user.team_id in visible_team_ids}

    return DirectoryResponse(
        organization=OrganizationResponse(id=enterprise.id, name=enterprise.name, account_owner_id=owner.id, account_owner_name=owner.name, account_owner_email=owner.email, users_count=len(visible_users), teams_count=len(visible_teams), created_at=enterprise.created_at),
        accounts=[account_response(user) for user in visible_users],
        teams=[TeamResponse(id=team.id, name=team.name, manager_name=manager_by_team.get(team.id)) for team in visible_teams],
        attendance=[AttendanceResponse(id=entry.id, user_id=entry.user_id, check_in=entry.check_in, check_out=entry.check_out, status=attendance_status(entry.check_in, start_minutes, settings.app_timezone)) for entry in attendance],
        self_attendance=SelfAttendanceResponse(id=self_attendance.id, user_id=self_attendance.user_id, check_in=self_attendance.check_in, check_out=self_attendance.check_out, status=attendance_status(self_attendance.check_in, start_minutes, settings.app_timezone)) if self_attendance else None,
        open_attendance=SelfAttendanceResponse(id=open_attendance.id, user_id=open_attendance.user_id, check_in=open_attendance.check_in, check_out=open_attendance.check_out, status=attendance_status(open_attendance.check_in, start_minutes, settings.app_timezone)) if open_attendance else None,
        attendance_policy=AttendancePolicyResponse(start_time=format_start_time(start_minutes), start_minutes=start_minutes, timezone=settings.app_timezone),
        leave_policy=LeavePolicyResponse(annual_days=getattr(enterprise, "annual_leave_days", 12), medical_days=getattr(enterprise, "medical_leave_days", 8)),
    )


@router.post("/accounts", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_organization_account(
    payload: OrganizationAccountCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> AccountResponse:
    enterprise_id = require_org_user(current_user)
    if current_user.role not in ACCOUNT_ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the organization owner or HR can create accounts.")

    email = payload.email.lower()
    if await db.scalar(select(User).where(func.lower(User.email) == email)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account already exists for this email.")
    if payload.role == "hr" and current_user.role not in OWNER_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the organization owner can create HR accounts.")

    user = User(enterprise_id=enterprise_id, name=payload.name, email=email, hashed_password=get_password_hash(payload.password), role=Role(payload.role), account_status="active", employee_id=payload.employee_id, department=payload.department, recognition_status="not_enrolled")
    db.add(user)
    await db.flush()
    db.add(AuditLog(actor_id=current_user.id, action="organization.account_created", target_id=str(user.id), details={"role": user.role.value, "email": user.email}))
    await db.commit()
    await db.refresh(user)
    return account_response(user)


@router.patch("/accounts/{user_id}/role", response_model=AccountResponse)
async def change_account_role(
    user_id: UUID,
    payload: RoleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> AccountResponse:
    enterprise_id = require_org_user(current_user)
    if current_user.role not in OWNER_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the organization owner can change account roles.")
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found.")
    ensure_same_org(target, enterprise_id)
    if target.id == current_user.id or target.role in OWNER_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="The organization owner role cannot be changed here.")
    target.role = Role(payload.role)
    if target.role != Role.MANAGER:
        target.team_id = None
    db.add(AuditLog(actor_id=current_user.id, action="organization.account_role_changed", target_id=str(target.id), details={"role": target.role.value}))
    await db.commit()
    await db.refresh(target)
    return account_response(target)


@router.delete("/accounts/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_organization_account(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    enterprise_id = require_org_user(current_user)
    if current_user.role not in OWNER_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the organization owner can remove people.")
    target = await db.get(User, user_id)
    if target is None or target.account_status == "removed":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found.")
    ensure_same_org(target, enterprise_id)
    if target.id == current_user.id or target.role in OWNER_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="The organization owner cannot be removed.")
    from .face_db import delete_user_face

    delete_user_face(str(target.id))
    target.account_status = "removed"
    target.team_id = None
    db.add(AuditLog(actor_id=current_user.id, action="organization.account_removed", target_id=str(target.id), details={"email": target.email}))
    await db.commit()


@router.post("/teams", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    payload: TeamCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> TeamResponse:
    enterprise_id = require_org_user(current_user)
    if current_user.role not in ACCOUNT_ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the organization owner or HR can create teams.")
    if await db.scalar(select(Team).where(Team.enterprise_id == enterprise_id, func.lower(Team.name) == payload.name.lower())) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A team with this name already exists.")
    team = Team(enterprise_id=enterprise_id, name=payload.name)
    db.add(team)
    await db.flush()
    db.add(AuditLog(actor_id=current_user.id, action="organization.team_created", target_id=str(team.id), details={"name": team.name}))
    await db.commit()
    return TeamResponse(id=team.id, name=team.name, manager_name=None)


@router.post("/accounts/{user_id}/team", response_model=AccountResponse)
async def assign_existing_employee(
    user_id: UUID,
    payload: TeamAssignmentDirect,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> AccountResponse:
    enterprise_id = require_org_user(current_user)
    if current_user.role not in ASSIGNMENT_REVIEW_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the organization owner or HR can assign employees to teams.")
    employee = await get_employee(db, user_id, enterprise_id)
    team = await get_team(db, payload.team_id, enterprise_id)
    employee.team_id = team.id
    db.add(AuditLog(actor_id=current_user.id, action="organization.employee_assigned", target_id=str(employee.id), details={"team_id": str(team.id)}))
    await db.commit()
    await db.refresh(employee)
    return account_response(employee)


@router.post("/team-requests", response_model=TeamAssignmentRequestResponse, status_code=status.HTTP_201_CREATED)
async def request_team_assignment(
    payload: TeamAssignmentRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> TeamAssignmentRequestResponse:
    enterprise_id = require_org_user(current_user)
    if current_user.role != Role.MANAGER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only managers can request team assignments.")
    if current_user.team_id != payload.team_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Managers can request assignments only for their own team.")
    await get_team(db, payload.team_id, enterprise_id)
    query = payload.employee_query.lower()
    employee = await db.scalar(select(User).where(User.enterprise_id == enterprise_id, User.role == Role.EMPLOYEE, or_(func.lower(User.name) == query, func.lower(User.email) == query, func.lower(User.employee_id) == query)))
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existing employee matched that name, email, or employee ID. Ask HR to create the account first.")
    if employee.team_id is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This employee is already assigned to a team.")
    pending = await db.scalar(select(TeamAssignmentRequest).where(TeamAssignmentRequest.employee_id == employee.id, TeamAssignmentRequest.team_id == payload.team_id, TeamAssignmentRequest.status == "pending"))
    if pending is not None:
        return await request_response(db, pending)
    item = TeamAssignmentRequest(enterprise_id=enterprise_id, team_id=payload.team_id, employee_id=employee.id, requested_by_id=current_user.id)
    db.add(item)
    await db.flush()
    db.add(AuditLog(actor_id=current_user.id, action="organization.team_assignment_requested", target_id=str(employee.id), details={"team_id": str(payload.team_id)}))
    await db.commit()
    await db.refresh(item)
    return await request_response(db, item)


@router.get("/team-requests", response_model=list[TeamAssignmentRequestResponse])
async def list_team_assignment_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[TeamAssignmentRequestResponse]:
    enterprise_id = require_org_user(current_user)
    if current_user.role in ASSIGNMENT_REVIEW_ROLES:
        query = select(TeamAssignmentRequest).where(TeamAssignmentRequest.enterprise_id == enterprise_id)
    elif current_user.role == Role.MANAGER:
        query = select(TeamAssignmentRequest).where(TeamAssignmentRequest.enterprise_id == enterprise_id, TeamAssignmentRequest.requested_by_id == current_user.id)
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot view team assignment requests.")
    items = list((await db.scalars(query.order_by(TeamAssignmentRequest.created_at.desc()))).all())
    return [await request_response(db, item) for item in items]


async def review_team_request(request_id: UUID, approve: bool, current_user: User, db: AsyncSession) -> TeamAssignmentRequestResponse:
    enterprise_id = require_org_user(current_user)
    if current_user.role not in ASSIGNMENT_REVIEW_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the organization owner or HR can review team requests.")
    item = await db.scalar(select(TeamAssignmentRequest).where(TeamAssignmentRequest.id == request_id, TeamAssignmentRequest.enterprise_id == enterprise_id))
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team assignment request not found.")
    if item.status != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This team assignment request has already been reviewed.")
    employee = await get_employee(db, item.employee_id, enterprise_id)
    if approve:
        if employee.team_id is not None and employee.team_id != item.team_id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This employee is already assigned to another team.")
        employee.team_id = item.team_id
        item.status = "approved"
    else:
        item.status = "rejected"
    item.reviewed_by_id = current_user.id
    item.reviewed_at = utc_now_naive()
    db.add(AuditLog(actor_id=current_user.id, action=f"organization.team_assignment_{item.status}", target_id=str(item.employee_id), details={"request_id": str(item.id), "team_id": str(item.team_id)}))
    await db.commit()
    await db.refresh(item)
    return await request_response(db, item)


@router.post("/team-requests/{request_id}/approve", response_model=TeamAssignmentRequestResponse)
async def approve_team_assignment_request(request_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_session)) -> TeamAssignmentRequestResponse:
    return await review_team_request(request_id, True, current_user, db)


@router.post("/team-requests/{request_id}/reject", response_model=TeamAssignmentRequestResponse)
async def reject_team_assignment_request(request_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_session)) -> TeamAssignmentRequestResponse:
    return await review_team_request(request_id, False, current_user, db)


async def _exception_response(db: AsyncSession, item: AttendanceException) -> AttendanceExceptionResponse:
    subject = await db.get(User, item.subject_user_id)
    if subject is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Exception account data is unavailable.")
    return AttendanceExceptionResponse(
        id=item.id,
        subject_user_id=item.subject_user_id,
        subject_user_name=subject.name,
        attendance_id=item.attendance_id,
        exception_type=item.exception_type,
        severity=item.severity,
        status=item.status,
        title=item.title,
        message=item.message,
        created_at=item.created_at,
        acknowledged_at=item.acknowledged_at,
        resolved_at=item.resolved_at,
    )


async def _ensure_missing_checkout_exceptions(db: AsyncSession, enterprise_id: UUID, timezone_name: str) -> list[AttendanceException]:
    today_start, _ = local_day_bounds_utc_naive(timezone_name)
    open_entries = list(
        (
            await db.scalars(
                select(AttendanceLog)
                .where(
                    AttendanceLog.check_out.is_(None),
                    AttendanceLog.check_in < today_start,
                    AttendanceLog.user_id.in_(select(User.id).where(User.enterprise_id == enterprise_id)),
                )
            )
        ).all()
    )
    created_items: list[AttendanceException] = []
    for entry in open_entries:
        subject = await db.get(User, entry.user_id)
        if subject is None:
            continue
        item, created = await get_or_create_exception(
            db,
            enterprise_id=enterprise_id,
            subject_user_id=subject.id,
            attendance_id=entry.id,
            exception_type="missing_checkout",
            severity="high",
            title="Missing checkout",
            message=f"{subject.name} has an open attendance record from {entry.check_in.date().isoformat()}.",
            source_key=f"missing-checkout:{entry.id}",
        )
        if created:
            created_items.append(item)
    if created_items:
        await db.commit()
        for item in created_items:
            await db.refresh(item)
            await publish_exception_event(db, item)
    return created_items


@router.get("/exceptions", response_model=list[AttendanceExceptionResponse])
async def list_attendance_exceptions(
    exception_status: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
) -> list[AttendanceExceptionResponse]:
    enterprise_id = require_org_user(current_user)
    if exception_status is not None and exception_status not in {"open", "acknowledged", "resolved"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid exception status filter.")
    await _ensure_missing_checkout_exceptions(db, enterprise_id, settings.app_timezone)

    query = select(AttendanceException).where(AttendanceException.enterprise_id == enterprise_id)
    if current_user.role == Role.MANAGER:
        if current_user.team_id is None:
            query = query.where(AttendanceException.subject_user_id == current_user.id)
        else:
            query = query.join(User, User.id == AttendanceException.subject_user_id).where(User.team_id == current_user.team_id)
    elif current_user.role not in REVIEW_ROLES:
        query = query.where(AttendanceException.subject_user_id == current_user.id)
    if exception_status is not None:
        query = query.where(AttendanceException.status == exception_status)
    items = list((await db.scalars(query.order_by(AttendanceException.created_at.desc()).limit(100))).all())
    return [await _exception_response(db, item) for item in items]


@router.post("/exceptions/{exception_id}/review", response_model=AttendanceExceptionResponse)
async def review_attendance_exception(
    exception_id: UUID,
    payload: AttendanceExceptionReview,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> AttendanceExceptionResponse:
    enterprise_id = require_org_user(current_user)
    item = await db.scalar(
        select(AttendanceException).where(
            AttendanceException.id == exception_id,
            AttendanceException.enterprise_id == enterprise_id,
        )
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance exception not found.")
    if current_user.role not in REVIEW_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot review attendance exceptions.")
    subject = await db.get(User, item.subject_user_id)
    if subject is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exception account not found.")
    if current_user.role == Role.MANAGER and subject.team_id != current_user.team_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot review this team exception.")
    if item.status == "resolved":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This attendance exception is already resolved.")

    now = utc_now_naive()
    if payload.status == "acknowledged":
        item.status = "acknowledged"
        item.acknowledged_at = item.acknowledged_at or now
        item.acknowledged_by_id = item.acknowledged_by_id or current_user.id
        action = "organization.attendance_exception_acknowledged"
    else:
        if item.acknowledged_at is None:
            item.acknowledged_at = now
            item.acknowledged_by_id = current_user.id
        item.status = "resolved"
        item.resolved_at = now
        item.resolved_by_id = current_user.id
        action = "organization.attendance_exception_resolved"
    db.add(AuditLog(actor_id=current_user.id, action=action, target_id=str(item.id), details={"exception_type": item.exception_type, "subject_user_id": str(item.subject_user_id)}))
    await db.commit()
    await db.refresh(item)
    await publish_exception_event(db, item)
    return await _exception_response(db, item)
