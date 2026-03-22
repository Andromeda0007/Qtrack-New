"""Unique 8-character public identifiers for batches (human + scan friendly)."""
import re
import secrets
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory_models import Batch

_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"
_CODE_LEN = 8
_CODE_PATTERN = re.compile(r"^[a-z0-9]{8}$")


def normalize_public_code_input(raw: str) -> str | None:
    """Return lowercase 8-char code if input looks like a public code, else None."""
    s = (raw or "").strip()
    if s.startswith("#"):
        s = s[1:].strip()
    s = s.lower()
    if _CODE_PATTERN.fullmatch(s):
        return s
    return None


async def generate_unique_public_code(db: AsyncSession) -> str:
    """Generate a random 8-char code; retries until unique."""
    for _ in range(200):
        code = "".join(secrets.choice(_ALPHABET) for _ in range(_CODE_LEN))
        existing = await db.execute(select(Batch.id).where(Batch.public_code == code))
        if existing.scalar_one_or_none() is None:
            return code
    raise RuntimeError("Could not allocate unique batch public_code")
