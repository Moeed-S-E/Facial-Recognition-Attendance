from uuid import UUID

import jwt

from app.auth import (
    ALGORITHM,
    SECRET_KEY,
    _user_token_claims,
    create_access_token,
    get_password_hash,
    verify_password,
)
from app.models import Role, User

def test_password_hashing_and_verification():
    password = "supersecretpassword123!"
    hashed = get_password_hash(password)
    
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrongpassword", hashed) is False

def test_create_access_token():
    data = {"sub": "test@example.com"}
    token = create_access_token(data)
    
    assert isinstance(token, str)
    
    # Verify the token decodes correctly
    decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert decoded.get("sub") == "test@example.com"
    assert "exp" in decoded


def test_user_token_claims_use_stable_uuid_subject():
    user_id = UUID("11111111-1111-1111-1111-111111111111")
    user = User(
        id=user_id,
        name="Test User",
        email="test@example.com",
        role=Role.EMPLOYEE,
        onboarded=False,
        token_version=3,
    )

    claims = _user_token_claims(user)

    assert claims["sub"] == str(user_id)
    assert claims["id"] == str(user_id)
    assert claims["email"] == "test@example.com"
    assert claims["token_version"] == 3
