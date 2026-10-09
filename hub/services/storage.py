import hashlib
import os
import re
from pathlib import Path
from django.conf import settings


def store_private_file(org_id: str, doc_id: str, version_number: int, file_name: str, file_bytes: bytes) -> dict:
    safe_name = re.sub(r'[^a-zA-Z0-9._-]', '_', file_name)
    file_hash = hashlib.sha256(file_bytes).hexdigest()
    rel_path = f"org_{org_id}/docs/{doc_id}/v{version_number}_{safe_name}"

    full_path = Path(settings.MEDIA_ROOT) / rel_path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_bytes(file_bytes)

    return {
        "storage_path": rel_path,
        "file_hash": file_hash,
        "file_size_bytes": len(file_bytes),
    }


def read_private_file(storage_path: str) -> bytes | None:
    full_path = Path(settings.MEDIA_ROOT) / storage_path
    if not full_path.exists():
        return None
    return full_path.read_bytes()
