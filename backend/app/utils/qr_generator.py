import os
import base64
import qrcode
from qrcode.image.pure import PyPNGImage
from app.config import settings


def get_qr_base64(filepath: str) -> str:
    """Read a saved QR PNG and return base64-encoded string."""
    try:
        with open(filepath, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")
    except Exception:
        return ""


def generate_batch_qr(batch_id: int, batch_number: str, public_code: str | None = None) -> str:
    """Generate QR code for a batch. Returns the relative file path.

    When public_code is set, it is appended so scans can cross-check; legacy QRs
    without it still parse.
    """
    os.makedirs(settings.QR_DIR, exist_ok=True)

    data = f"QTRACK|BATCH|{batch_id}|{batch_number}"
    if public_code:
        data = f"{data}|{public_code}"
    filename = f"batch_{batch_id}.png"
    filepath = os.path.join(settings.QR_DIR, filename)

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img.save(filepath)

    return filepath


def generate_container_qr(batch_id: int, container_number: int, unique_code: str) -> str:
    """Generate a per-container QR.

    Encoded payload: ``QTRACK|CNT|<unique_code>`` — a single token that the
    scanner can match directly against ``batch_containers.unique_code``.
    Also compatible with the legacy parser (entity_type=``CNT``, entity_id=0
    when no numeric id is meaningful).
    """
    os.makedirs(settings.QR_DIR, exist_ok=True)

    data = f"QTRACK|CNT|{unique_code}"
    filename = f"cnt_{batch_id}_{container_number}.png"
    filepath = os.path.join(settings.QR_DIR, filename)

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img.save(filepath)

    return filepath


def generate_fg_qr(fg_batch_id: int, fg_batch_number: str) -> str:
    """Generate QR code for a finished goods batch."""
    os.makedirs(settings.QR_DIR, exist_ok=True)

    data = f"QTRACK|FG|{fg_batch_id}|{fg_batch_number}"
    filename = f"fg_{fg_batch_id}.png"
    filepath = os.path.join(settings.QR_DIR, filename)

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img.save(filepath)

    return filepath


def parse_qr_data(qr_string: str) -> dict:
    """Parse QR string and return entity type and ID."""
    parts = qr_string.split("|")
    if len(parts) < 3 or parts[0] != "QTRACK":
        raise ValueError("Invalid QTrack QR code format")

    entity_type = parts[1]
    entity_id = int(parts[2])
    entity_number = parts[3] if len(parts) > 3 else None
    public_code = parts[4] if len(parts) > 4 else None

    return {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "entity_number": entity_number,
        "public_code": public_code,
    }
