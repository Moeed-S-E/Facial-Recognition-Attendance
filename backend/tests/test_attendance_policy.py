from datetime import datetime

import pytest
from pydantic import ValidationError

from app.attendance_policy import attendance_status
from app.schemas import LeavePolicyUpdate, LeaveRequestCreate


def test_check_in_before_default_start_is_present():
    # Stored values are naive UTC; 03:59 UTC is 08:59 in Pakistan.
    assert attendance_status(datetime(2026, 8, 19, 3, 59)) == "Present"


def test_check_in_at_default_start_is_late():
    # Stored values are naive UTC; 04:00 UTC is 09:00 in Pakistan.
    assert attendance_status(datetime(2026, 8, 19, 4, 0)) == "Late"


def test_late_threshold_can_be_configured():
    assert attendance_status(datetime(2026, 8, 19, 4, 29), 9 * 60 + 30) == "Present"
    assert attendance_status(datetime(2026, 8, 19, 4, 30), 9 * 60 + 30) == "Late"


def test_offline_leave_request_accepts_client_request_id():
    request = LeaveRequestCreate(
        leave_type="Annual leave",
        start_date="2026-08-20",
        end_date="2026-08-21",
        note="Family event",
        client_request_id="web-request-123",
    )
    assert request.client_request_id == "web-request-123"


def test_offline_leave_request_rejects_oversized_client_request_id():
    with pytest.raises(ValidationError):
        LeaveRequestCreate(
            leave_type="Annual leave",
            start_date="2026-08-20",
            end_date="2026-08-21",
            client_request_id="x" * 65,
        )


def test_leave_policy_accepts_bounded_allowances():
    policy = LeavePolicyUpdate(annual_days=18, medical_days=10)
    assert policy.annual_days == 18
    assert policy.medical_days == 10


@pytest.mark.parametrize("field", ["annual_days", "medical_days"])
def test_leave_policy_rejects_out_of_range_allowances(field):
    payload = {"annual_days": 12, "medical_days": 8}
    payload[field] = 366
    with pytest.raises(ValidationError):
        LeavePolicyUpdate(**payload)
