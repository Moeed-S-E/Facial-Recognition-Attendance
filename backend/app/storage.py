from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID, uuid4

from .config import Settings


class StorageConfigurationError(RuntimeError):
    """Raised when private evidence storage cannot be configured safely."""


class LocalPrivateStorage:
    """Filesystem-backed private storage outside the web server document root."""

    backend_name = "local-private-filesystem"

    def __init__(self, root: Path) -> None:
        self.root = root.expanduser().resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def save(self, object_path: str, content: bytes) -> str:
        destination = (self.root / object_path).resolve()
        try:
            destination.relative_to(self.root)
        except ValueError as error:
            raise StorageConfigurationError("Evidence path escaped the private storage root.") from error

        destination.parent.mkdir(parents=True, exist_ok=True)
        try:
            with destination.open("xb") as handle:
                handle.write(content)
        except FileExistsError as error:
            raise StorageConfigurationError("Evidence object already exists.") from error
        destination.chmod(0o600)
        return object_path


def get_storage_backend(settings: Settings) -> LocalPrivateStorage:
    storage_root = Path(settings.evidence_storage_dir)
    if not storage_root.is_absolute():
        storage_root = Path.cwd() / storage_root
    return LocalPrivateStorage(storage_root)


def build_evidence_path(employee_id: str, attendance_id: UUID) -> str:
    """Create a non-guessable, date-partitioned private object path."""

    date_prefix = datetime.now(UTC).strftime("%Y/%m/%d")
    safe_employee_id = "".join(character for character in employee_id if character.isalnum() or character in "-_")
    safe_employee_id = safe_employee_id or "employee"
    return f"evidence/{date_prefix}/{safe_employee_id}/{attendance_id}-{uuid4()}.jpg"


def upload_evidence(
    settings: Settings,
    *,
    employee_id: str,
    attendance_id: UUID,
    content: bytes,
    content_type: str,
) -> str:
    """Persist prevalidated JPEG evidence in private filesystem storage."""

    if content_type != "image/jpeg":
        raise StorageConfigurationError("Only JPEG evidence can be stored.")
    if not content:
        raise StorageConfigurationError("Evidence content is empty.")

    object_path = build_evidence_path(employee_id, attendance_id)
    return get_storage_backend(settings).save(object_path, content)
