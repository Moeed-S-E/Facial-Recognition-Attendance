from __future__ import annotations

import io
import os
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError

MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024
MAX_PROFILE_IMAGE_PIXELS = 20_000_000
MAX_PROFILE_IMAGE_SIDE = 512
Image.MAX_IMAGE_PIXELS = MAX_PROFILE_IMAGE_PIXELS


def profile_image_dir(storage_dir: str) -> Path:
    path = Path(storage_dir).resolve() / "profile-images"
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    return path


async def save_profile_image(upload: UploadFile, storage_dir: str, previous_name: str | None = None, output_name: str | None = None) -> str:
    content = await upload.read(MAX_PROFILE_IMAGE_BYTES + 1)
    if len(content) > MAX_PROFILE_IMAGE_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Profile image is too large.")
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A profile image is required.")

    try:
        with Image.open(io.BytesIO(content)) as image:
            if image.format not in {"JPEG", "PNG", "WEBP"}:
                raise ValueError("unsupported format")
            if image.width * image.height > MAX_PROFILE_IMAGE_PIXELS:
                raise ValueError("too many pixels")
            image.verify()
        with Image.open(io.BytesIO(content)) as image:
            image = image.convert("RGB")
            image.thumbnail((MAX_PROFILE_IMAGE_SIDE, MAX_PROFILE_IMAGE_SIDE), Image.Resampling.LANCZOS)
            output = io.BytesIO()
            image.save(output, format="JPEG", quality=88, optimize=True)
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Upload a valid image file.") from exc

    filename = output_name or f"{uuid.uuid4().hex}.jpg"
    if Path(filename).name != filename or not filename.endswith(".jpg"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid profile image name.")
    target = profile_image_dir(storage_dir) / filename
    target.write_bytes(output.getvalue())
    os.chmod(target, 0o600)

    if previous_name:
        old = profile_image_dir(storage_dir) / Path(previous_name).name
        if old != target:
            old.unlink(missing_ok=True)
    return filename


def profile_image_path(storage_dir: str, filename: str | None) -> Path | None:
    if not filename:
        return None
    safe_name = Path(filename).name
    if safe_name != filename or not safe_name.endswith(".jpg"):
        return None
    path = profile_image_dir(storage_dir) / safe_name
    return path if path.is_file() else None


# ponytail: re-encoding is the malware boundary; virus scanning can be added when uploads are externally shared.
