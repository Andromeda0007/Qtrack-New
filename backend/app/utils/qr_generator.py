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


def generate_batch_qr(batch_id: int, batch_number: str) -> str:
    """Generate QR code for a batch. Returns the relative file path."""
    os.makedirs(settings.QR_DIR, exist_ok=True)

    data = f"QTRACK|BATCH|{batch_id}|{batch_number}"
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

    return {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "entity_number": entity_number,
    }
