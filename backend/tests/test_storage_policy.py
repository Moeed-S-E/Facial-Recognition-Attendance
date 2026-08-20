import re
from uuid import uuid4

import pytest

from app.config import Settings
from app.storage import (
    StorageConfigurationError,
    build_evidence_path,
    get_storage_backend,
    upload_evidence,
)


def test_filesystem_storage_creates_private_backend_and_writes_evidence(tmp_path) -> None:
    settings = Settings(evidence_storage_dir=str(tmp_path))
    attendance_id = uuid4()
    content = b"valid-jpeg-bytes"

    object_path = upload_evidence(
        settings,
        employee_id="employee-01",
        attendance_id=attendance_id,
        content=content,
        content_type="image/jpeg",
    )

    stored_file = tmp_path / object_path
    assert get_storage_backend(settings).backend_name == "local-private-filesystem"
    assert stored_file.read_bytes() == content
    assert stored_file.stat().st_mode & 0o777 == 0o600


def test_evidence_path_uses_a_private_date_partition_and_safe_employee_id() -> None:
    attendance_id = uuid4()
    path = build_evidence_path("employee 01/../!", attendance_id)
    assert path.startswith("evidence/")
    assert "/employee01/" in path
    assert re.fullmatch(rf"evidence/\d{{4}}/\d{{2}}/\d{{2}}/employee01/{attendance_id}-[0-9a-f-]+\.jpg", path)


def test_invalid_content_type_is_rejected(tmp_path) -> None:
    settings = Settings(evidence_storage_dir=str(tmp_path))
    with pytest.raises(StorageConfigurationError, match="Only JPEG"):
        upload_evidence(
            settings,
            employee_id="employee-01",
            attendance_id=uuid4(),
            content=b"content",
            content_type="text/plain",
        )


def test_object_path_cannot_escape_private_storage_root(tmp_path) -> None:
    storage = get_storage_backend(Settings(evidence_storage_dir=str(tmp_path)))
    with pytest.raises(StorageConfigurationError, match="escaped"):
        storage.save("../../outside.jpg", b"content")
