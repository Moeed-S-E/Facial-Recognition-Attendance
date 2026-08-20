import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from app.config import Settings
from app.main import create_app


@pytest.fixture
def local_only_client() -> TestClient:
    """Build the default privacy-preserving API without external credentials."""

    app = create_app(
        Settings(
            cors_allowed_origins=["http://localhost:8081"],
            attendance_retention_mode="local-only",
        )
    )
    with TestClient(app) as client:
        yield client


@pytest.fixture
def retention_enabled_client() -> TestClient:
    """Build a test-only service that allows validation before storage is called."""

    app = create_app(
        Settings(
            cors_allowed_origins=["http://localhost:8081"],
            attendance_retention_mode="approved-evidence",
            max_evidence_bytes=1024,
        )
    )
    with TestClient(app) as client:
        yield client
