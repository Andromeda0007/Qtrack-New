import os
from reportlab.lib.pagesizes import inch
from reportlab.pdfgen import canvas
from reportlab.lib import colors

from app.config import settings


def generate_quarantine_label(batch_data: dict, *, variant: str = "quarantine") -> str:
    """Generate a quarantine label PDF for a raw material batch.

    variant: "quarantine" | "retest" — retest shows QUARANTINE – RETESTING and extra lines.
    """
    os.makedirs(settings.LABEL_DIR, exist_ok=True)

    suffix = "_retest" if variant == "retest" else ""
    filename = f"quarantine_label_{batch_data['batch_id']}{suffix}.pdf"
    filepath = os.path.join(settings.LABEL_DIR, filename)

    width, height = 4 * inch, 6 * inch
    c = canvas.Canvas(filepath, pagesize=(width, height))

    c.setStrokeColor(colors.black)
    c.setLineWidth(2)
    c.rect(0.1 * inch, 0.1 * inch, width - 0.2 * inch, height - 0.2 * inch)

    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 14)
    title = (
        "QUARANTINE – RETESTING"
        if variant == "retest"
        else "QUARANTINE"
    )
    c.drawCentredString(width / 2, height - 0.48 * inch, title)

    c.setLineWidth(1)
    c.line(0.2 * inch, height - 0.65 * inch, width - 0.2 * inch, height - 0.65 * inch)

    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(colors.black)
    y = height - 0.88 * inch
    line_height = 0.22 * inch

    track = batch_data.get("track_id") or batch_data.get("public_code")
    if track and not str(track).startswith("#"):
        track = f"#{track}"

    per_container = batch_data.get("per_container_qty")
    if per_container is None:
        per_container = batch_data.get("pack_size", "")
    pack_def = batch_data.get("pack_size_description") or ""

    fields = [
        ("Material", batch_data.get("material_name", "")),
        ("Track ID", str(track or "")),
        ("Batch No.", batch_data.get("batch_number", "")),
        ("Product No. (GRN)", batch_data.get("grn_number", "")),
        ("Pack type", str(batch_data.get("pack_type", ""))),
        (
            "Qty / drum-bag-box",
            f"{per_container} {batch_data.get('unit', '')}".strip(),
        ),
        ("Pack size (std)", pack_def),
        ("Total Qty", str(batch_data.get("total_quantity", "")) + " " + batch_data.get("unit", "")),
        ("Mfg Date", str(batch_data.get("manufacture_date", ""))),
        ("Exp Date", str(batch_data.get("expiry_date", ""))),
        ("Supplier", batch_data.get("supplier_name", "")),
    ]
    if variant == "retest":
        fields.insert(
            6,
            ("Retest ref", str(batch_data.get("retest_ref", ""))),
        )
        fields.insert(7, ("A.R. No.", str(batch_data.get("ar_number", ""))))

    for label, value in fields:
        c.setFont("Helvetica-Bold", 8)
        c.drawString(0.25 * inch, y, f"{label}:")
        c.setFont("Helvetica", 8)
        c.drawString(1.2 * inch, y, str(value))
        y -= line_height

    qr_path = batch_data.get("qr_path", "")
    if qr_path and os.path.exists(qr_path):
        c.drawImage(qr_path, width / 2 - 0.75 * inch, 0.3 * inch, 1.5 * inch, 1.5 * inch)

    c.save()
    return filepath


def generate_shipper_label(fg_data: dict) -> str:
    """Generate a shipper label PDF for a finished goods batch."""
    os.makedirs(settings.LABEL_DIR, exist_ok=True)

    filename = f"shipper_label_{fg_data['fg_batch_id']}.pdf"
    filepath = os.path.join(settings.LABEL_DIR, filename)

    width, height = 4 * inch, 6 * inch
    c = canvas.Canvas(filepath, pagesize=(width, height))

    c.setStrokeColor(colors.black)
    c.setLineWidth(2)
    c.rect(0.1 * inch, 0.1 * inch, width - 0.2 * inch, height - 0.2 * inch)

    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width / 2, height - 0.5 * inch, "SHIPPER LABEL")

    c.setLineWidth(1)
    c.line(0.2 * inch, height - 0.65 * inch, width - 0.2 * inch, height - 0.65 * inch)

    y = height - 0.9 * inch
    line_height = 0.25 * inch

    fields = [
        ("Product", fg_data.get("product_name", "")),
        ("Batch No.", fg_data.get("batch_number", "")),
        ("Mfg Date", str(fg_data.get("manufacture_date", ""))),
        ("Exp Date", str(fg_data.get("expiry_date", ""))),
        ("Net Wt.", str(fg_data.get("net_weight", "")) + " kg"),
        ("Gross Wt.", str(fg_data.get("gross_weight", "")) + " kg"),
        ("Quantity", str(fg_data.get("quantity", ""))),
        ("Carton No.", str(fg_data.get("carton_number", ""))),
    ]

    for label, value in fields:
        c.setFont("Helvetica-Bold", 8)
        c.drawString(0.25 * inch, y, f"{label}:")
        c.setFont("Helvetica", 8)
        c.drawString(1.2 * inch, y, str(value))
        y -= line_height

    qr_path = fg_data.get("qr_path", "")
    if qr_path and os.path.exists(qr_path):
        c.drawImage(qr_path, width / 2 - 0.75 * inch, 0.3 * inch, 1.5 * inch, 1.5 * inch)

    c.save()
    return filepath
