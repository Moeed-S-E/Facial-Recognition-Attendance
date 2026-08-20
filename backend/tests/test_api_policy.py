from datetime import UTC, datetime
from uuid import uuid4

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def consent_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "attendance_id": str(uuid4()),
        "employee_id": "employee-001",
        "consent_version": "2026-08",
        "retention_mode": "approved-evidence",
        "local_processing_acknowledged": True,
        "server_retention_authorized": True,
        "declared_at": datetime.now(UTC).isoformat(),
    }
    payload.update(overrides)
    return payload


def evidence_form() -> dict[str, str]:
    return {
        "attendance_id": str(uuid4()),
        "employee_id": "employee-001",
        "consent_id": str(uuid4()),
    }


def test_local_web_origin_is_allowed_by_default() -> None:
    app = create_app(Settings(attendance_retention_mode="local-only"))

    with TestClient(app) as client:
        response = client.get("/health", headers={"Origin": "http://localhost:5173"})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_leave_policy_put_preflight_is_allowed() -> None:
    app = create_app(Settings(attendance_retention_mode="local-only"))

    with TestClient(app) as client:
        response = client.options(
            "/v1/organization/leave-policy",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "PUT",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "PUT" in response.headers["access-control-allow-methods"]


def test_health_reports_local_only_policy(local_only_client: TestClient) -> None:
    response = local_only_client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "retention_mode": "local-only"}


def test_local_only_policy_never_permits_server_evidence(local_only_client: TestClient) -> None:
    response = local_only_client.post("/v1/attendance/consent", json=consent_payload())

    assert response.status_code == 200
    assert response.json()["retention_mode"] == "local-only"
    assert response.json()["evidence_upload_permitted"] is False


def test_approved_evidence_requires_both_client_acknowledgements(
    retention_enabled_client: TestClient,
) -> None:
    response = retention_enabled_client.post(
        "/v1/attendance/consent",
        json=consent_payload(server_retention_authorized=False),
    )

    assert response.status_code == 200
    assert response.json()["evidence_upload_permitted"] is False


def test_approved_evidence_policy_permits_explicitly_authorized_flow(
    retention_enabled_client: TestClient,
) -> None:
    response = retention_enabled_client.post("/v1/attendance/consent", json=consent_payload())

    assert response.status_code == 200
    assert response.json()["retention_mode"] == "approved-evidence"
    assert response.json()["evidence_upload_permitted"] is True


def test_local_only_service_rejects_evidence_upload(local_only_client: TestClient) -> None:
    response = local_only_client.post(
        "/v1/attendance/evidence",
        data=evidence_form(),
        files={"evidence": ("capture.jpg", b"jpg", "image/jpeg")},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "This environment is configured for local-only attendance capture."


def test_evidence_route_rejects_non_jpeg_content(retention_enabled_client: TestClient) -> None:
    response = retention_enabled_client.post(
        "/v1/attendance/evidence",
        data=evidence_form(),
        files={"evidence": ("capture.png", b"png", "image/png")},
    )

    assert response.status_code == 415
    assert response.json()["detail"] == "Only JPEG evidence is accepted."


def test_evidence_route_rejects_invalid_jpeg_bytes(retention_enabled_client: TestClient) -> None:
    response = retention_enabled_client.post(
        "/v1/attendance/evidence",
        data=evidence_form(),
        files={"evidence": ("capture.jpg", b"\xff\xd8\xffnot-ended", "image/jpeg")},
    )

    assert response.status_code == 415
    assert response.json()["detail"] == "The uploaded file is not a valid JPEG image."


def test_evidence_route_rejects_capture_larger_than_policy(retention_enabled_client: TestClient) -> None:
    response = retention_enabled_client.post(
        "/v1/attendance/evidence",
        data=evidence_form(),
        files={"evidence": ("capture.jpg", b"x" * 1025, "image/jpeg")},
    )

    assert response.status_code == 413
    assert response.json()["detail"] == "Evidence exceeds the configured maximum size."
