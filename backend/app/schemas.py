from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ConsentDeclaration(BaseModel):
    """Client declaration made before a local capture can be considered for retention."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    attendance_id: UUID
    employee_id: str = Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9._:@+-]+$")
    consent_version: str = Field(min_length=1, max_length=32, pattern=r"^[A-Za-z0-9._-]+$")
    retention_mode: Literal["local-only", "approved-evidence"] = "local-only"
    local_processing_acknowledged: bool
    server_retention_authorized: bool = False
    declared_at: datetime


class ConsentDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    attendance_id: UUID
    retention_mode: Literal["local-only", "approved-evidence"]
    evidence_upload_permitted: bool
    message: str


class HealthStatus(BaseModel):
    status: Literal["ok"] = "ok"
    retention_mode: Literal["local-only", "approved-evidence"]


class EvidenceReceipt(BaseModel):
    object_path: str
    storage_backend: str
    content_type: str
    size_bytes: int


class TeamResponse(BaseModel):
    id: UUID
    name: str
    manager_name: str | None = None


class AccountResponse(BaseModel):
    id: UUID
    enterprise_id: UUID | None
    team_id: UUID | None
    name: str
    email: str
    employee_id: str | None = None
    department: str | None = None
    role: str
    role_label: str
    account_status: str
    recognition_status: str
    profile_image_url: str | None = None
    created_at: datetime


class OrganizationAccountCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=12, max_length=128)
    role: Literal["employee", "manager", "hr"] = "employee"
    employee_id: str | None = Field(default=None, max_length=128, pattern=r"^[A-Za-z0-9._:@+-]+$")
    department: str | None = Field(default=None, max_length=120)

    @field_validator("employee_id", "department", mode="before")
    @classmethod
    def blank_optional_values_to_none(cls, value):
        return None if isinstance(value, str) and not value.strip() else value


class TeamCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=120)


class TeamAssignmentRequestCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    employee_query: str = Field(min_length=1, max_length=255)
    team_id: UUID


class RoleUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    role: Literal["employee", "manager", "hr"]


class TeamAssignmentDirect(BaseModel):
    model_config = ConfigDict(extra="forbid")

    team_id: UUID


class LeaveRequestCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    leave_type: Literal["Annual leave", "Medical leave", "Sick leave", "Personal leave", "Personal day"]
    client_request_id: str | None = Field(default=None, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    start_date: date
    end_date: date
    note: str | None = Field(default=None, max_length=1000)

    @field_validator("end_date")
    @classmethod
    def end_date_not_before_start(cls, value, info):
        start_date = info.data.get("start_date")
        if start_date and value < start_date:
            raise ValueError("end_date must be on or after start_date")
        return value


class LeavePolicyResponse(BaseModel):
    annual_days: int
    medical_days: int


class LeavePolicyUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    annual_days: int = Field(ge=0, le=365)
    medical_days: int = Field(ge=0, le=365)


class LeaveRequestResponse(BaseModel):
    id: UUID
    requester_id: UUID
    requester_name: str
    leave_type: str
    start_date: date
    end_date: date
    note: str | None
    status: Literal["pending", "approved", "rejected"]
    reviewed_by_name: str | None
    created_at: datetime


class TeamAssignmentRequestResponse(BaseModel):
    id: UUID
    employee_id: UUID
    employee_name: str
    employee_email: str
    team_id: UUID
    team_name: str
    requested_by_name: str
    status: Literal["pending", "approved", "rejected"]
    created_at: datetime


class AttendanceResponse(BaseModel):
    id: UUID
    user_id: UUID
    check_in: datetime
    check_out: datetime | None
    status: str


class SelfAttendanceResponse(BaseModel):
    id: UUID
    user_id: UUID
    check_in: datetime
    check_out: datetime | None
    status: str


class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    account_owner_id: UUID
    account_owner_name: str
    account_owner_email: str
    users_count: int
    teams_count: int
    created_at: datetime


class AttendancePolicyResponse(BaseModel):
    start_time: str
    start_minutes: int
    timezone: str


class AttendancePolicyUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    start_time: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")


class DirectoryResponse(BaseModel):
    organization: OrganizationResponse
    accounts: list[AccountResponse]
    teams: list[TeamResponse]
    attendance: list[AttendanceResponse]
    self_attendance: SelfAttendanceResponse | None = None
    open_attendance: SelfAttendanceResponse | None = None
    attendance_policy: AttendancePolicyResponse | None = None
    leave_policy: LeavePolicyResponse | None = None


class AttendanceExceptionResponse(BaseModel):
    id: UUID
    subject_user_id: UUID
    subject_user_name: str
    attendance_id: UUID | None
    exception_type: str
    severity: str
    status: str
    title: str
    message: str
    created_at: datetime
    acknowledged_at: datetime | None
    resolved_at: datetime | None


class AttendanceExceptionReview(BaseModel):
    status: Literal["acknowledged", "resolved"]


class SeedResponse(BaseModel):
    seeded: bool
    organization_id: UUID
    accounts_created: int
    accounts: list[AccountResponse]


class FaceEnrollmentResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["enrolled"]
    recognition_status: Literal["enrolled"]


class PinSetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    pin: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class PinVerifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    action: Literal["check-in", "check-out"]
    pin: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class AttendanceVerificationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["verified"]
    action: Literal["check-in", "check-out"]
    attendance_id: UUID
    user_id: UUID
    face_distance: float = Field(ge=0)
    check_in: datetime
    check_out: datetime | None = None
    attendance_status: str
    already_recorded: bool = False


class AttendanceVerificationError(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["rejected"]
    reason: str
