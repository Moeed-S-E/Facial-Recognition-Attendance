import asyncio
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.config import Settings
from app.main import create_app
from app.notifications import NotificationHub, build_notification_subject_token


def test_websocket_receives_development_notification() -> None:
    app = create_app(Settings(environment="development", notification_ws_allow_unauthenticated_development=True))
    with TestClient(app) as client:
        with client.websocket_connect("/v1/notifications/ws?user_id=employee-1") as websocket:
            ready = websocket.receive_json()
            assert ready["type"] == "connection.ready"

            response = client.post(
                "/v1/demo/notifications/employee-1",
                json={
                    "event_type": "test.notification",
                    "title": "Test update",
                    "message": "The websocket delivery path is working.",
                },
            )
            assert response.status_code == 200
            assert response.json()["sent"] is True
            assert response.json()["delivered"] == 1

            event = websocket.receive_json()
            assert event["type"] == "test.notification"
            assert event["title"] == "Test update"
            assert event["message"] == "The websocket delivery path is working."


def test_notification_publish_allows_nested_user_id_payload() -> None:
    hub = NotificationHub()
    websocket = AsyncMock()
    hub._connections["employee-1"] = {websocket}

    delivered = asyncio.run(
        hub.publish(
            "employee-1",
            "attendance.verified",
            "Attendance verified",
            "Attendance was updated.",
            attendance_id="attendance-1",
            user_id="employee-1",
        )
    )

    assert delivered == 1
    payload = websocket.send_json.call_args.args[0]
    assert payload["data"]["user_id"] == "employee-1"


def test_websocket_requires_token_outside_development() -> None:
    app = create_app(
        Settings(
            environment="production",
            notification_ws_token="server-only-token",
            notification_ws_allow_unauthenticated_development=False,
        )
    )
    with TestClient(app) as client:
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect("/v1/notifications/ws?user_id=employee-1"):
                raise AssertionError("The websocket should reject unauthenticated production connections")

        settings = Settings(
            environment="production",
            notification_ws_token="server-only-token",
            notification_ws_allow_unauthenticated_development=False,
        )
        subject_token = build_notification_subject_token("employee-1", settings)
        with client.websocket_connect(f"/v1/notifications/ws?user_id=employee-1&token={subject_token}") as websocket:
            assert websocket.receive_json()["type"] == "connection.ready"

        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect(f"/v1/notifications/ws?user_id=manager-1&token={subject_token}"):
                raise AssertionError("A user-scoped websocket token must not authorize another subject")
