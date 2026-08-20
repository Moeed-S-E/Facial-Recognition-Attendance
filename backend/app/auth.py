import secrets
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from passlib.context import CryptContext
import jwt
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, ConfigDict, Field
from .config import get_settings
from .database import get_db_session
from .notifications import build_notification_subject_token
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .models import Enterprise, Role, User
from .limiter import limiter
from .profile_images import profile_image_path, save_profile_image

class Token(BaseModel):
    access_token: str
    token_type: str


class NotificationToken(BaseModel):
    token: str
    expires_in: int
    
class UserCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=12, max_length=128)
    role: Optional[Role] = Role.EMPLOYEE


class EnterpriseRegistration(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    organization_name: str = Field(min_length=2, max_length=160)
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=12, max_length=128)


class PasswordChange(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)

    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)

runtime_settings = get_settings()


def _authentication_secret(value: str | None, setting_name: str) -> str:
    if value:
        return value
    if runtime_settings.environment != "development":
        raise RuntimeError(f"{setting_name} must be configured outside development.")
    # Development tests get a random process-local value; no reusable secret is
    # shipped in source control and all users must re-authenticate on restart.
    return secrets.token_urlsafe(32)


SECRET_KEY = _authentication_secret(
    runtime_settings.jwt_secret.get_secret_value() if runtime_settings.jwt_secret else None,
    "JWT_SECRET",
)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # 1 hour; password changes also revoke prior tokens

# Pepper should be kept out of the DB entirely.
PEPPER = _authentication_secret(
    runtime_settings.password_pepper.get_secret_value() if runtime_settings.password_pepper else None,
    "PASSWORD_PEPPER",
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_password_hash(password: str) -> str:
    # Append pepper to password before hashing
    peppered_password = f"{password}{PEPPER}"
    return pwd_context.hash(peppered_password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    peppered_password = f"{plain_password}{PEPPER}"
    return pwd_context.verify(peppered_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def _user_token_claims(user: User) -> dict[str, object]:
    return {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role.value,
        "name": user.name,
        "id": str(user.id),
        "onboarded": user.onboarded,
        "token_version": user.token_version,
    }


async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db_session)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        subject = payload.get("sub")
        if not subject:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    user = None
    try:
        user_id = UUID(str(subject))
    except (TypeError, ValueError):
        # Accept pre-migration tokens whose subject was the email until expiry.
        result = await db.execute(select(User).where(User.email == str(subject)))
        user = result.scalar_one_or_none()
    else:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

    if user is None or user.account_status != "active":
        raise credentials_exception
    try:
        token_version = int(payload.get("token_version", 0))
    except (TypeError, ValueError):
        raise credentials_exception
    if token_version != user.token_version:
        raise credentials_exception
    return user

router = APIRouter(tags=["authentication"])


@router.post("/v1/auth/profile-image")
@limiter.limit("10/hour")
async def upload_profile_image(
    request: Request,
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, str]:
    del request
    filename = await save_profile_image(image, settings.evidence_storage_dir, current_user.profile_image_path)
    current_user.profile_image_path = filename
    await db.commit()
    return {"profile_image_url": f"/v1/auth/profile-image/{current_user.id}"}


@router.get("/v1/auth/profile-image/{user_id}")
@limiter.limit("120/minute")
async def get_profile_image(
    request: Request,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
):
    del request
    target = await db.get(User, user_id)
    if target is None or target.profile_image_path is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile image not found.")
    allowed = target.id == current_user.id
    if current_user.enterprise_id is not None and current_user.enterprise_id == target.enterprise_id:
        allowed = current_user.role in {Role.ENTERPRISE_ADMIN, Role.HR} or (
            current_user.role == Role.MANAGER and current_user.team_id == target.team_id
        )
    if not allowed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile image not found.")
    path = profile_image_path(settings.evidence_storage_dir, target.profile_image_path)
    if path is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile image not found.")
    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "private, no-store"})


@router.post("/v1/auth/password")
@limiter.limit("5/hour")
async def change_password(
    request: Request,
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    if not current_user.hashed_password or not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
    if verify_password(password_data.new_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be different.")
    current_user.hashed_password = get_password_hash(password_data.new_password)
    current_user.token_version += 1
    await db.commit()
    await db.refresh(current_user)
    access_token = create_access_token(
        data=_user_token_claims(current_user),
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"message": "Password changed successfully.", "access_token": access_token, "token_type": "bearer"}


@router.post("/token", response_model=Token)
@limiter.limit("5/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db_session)
):
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()
    
    if not user or user.account_status != "active" or not user.hashed_password or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data=_user_token_claims(user),
        expires_delta=access_token_expires,
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/v1/notifications/token", response_model=NotificationToken)
@limiter.limit("30/minute")
async def issue_notification_token(
    request: Request,
    settings = Depends(get_settings),
    current_user = Depends(get_current_user),
) -> NotificationToken:
    """Mint a short-lived WebSocket credential for the authenticated user."""

    del request
    if not settings.notifications_enabled or not settings.notification_ws_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Realtime notifications are temporarily unavailable.",
        )
    try:
        token = build_notification_subject_token(str(current_user.id), settings)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Realtime notifications are temporarily unavailable.",
        ) from error
    return NotificationToken(token=token, expires_in=300)


@router.post("/register")
@limiter.limit("5/minute")
async def register(
    request: Request,
    user_data: EnterpriseRegistration,
    db: AsyncSession = Depends(get_db_session),
):
    """Create a local organization and its owner account."""

    email = user_data.email.lower()
    result = await db.execute(select(User).where(User.email == email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    enterprise = Enterprise(name=user_data.organization_name)
    db.add(enterprise)
    await db.flush()

    owner = User(
        enterprise_id=enterprise.id,
        name=user_data.name,
        email=email,
        hashed_password=get_password_hash(user_data.password),
        role=Role.ENTERPRISE_ADMIN,
        account_status="active",
        recognition_status="not_enrolled",
    )
    db.add(owner)
    await db.commit()
    await db.refresh(owner)

    return {"message": "Organization account created successfully", "user_id": owner.id, "enterprise_id": enterprise.id}

class OnboardingData(BaseModel):
    name: str
    employee_id: str
    department: str

@router.post("/v1/users/onboard")
@limiter.limit("5/minute")
async def onboard_user(
    request: Request,
    onboarding_data: OnboardingData,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.onboarded:
        raise HTTPException(status_code=400, detail="User is already onboarded.")
        
    current_user.name = onboarding_data.name
    current_user.employee_id = onboarding_data.employee_id
    current_user.department = onboarding_data.department
    current_user.onboarded = True
    
    await db.commit()
    await db.refresh(current_user)
    
    # Generate new token with updated onboarded status
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data=_user_token_claims(current_user),
        expires_delta=access_token_expires,
    )
    
    return {"access_token": access_token, "token_type": "bearer"}
