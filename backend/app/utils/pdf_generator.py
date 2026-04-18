import io
import os
import qrcode
from reportlab.lib.pagesizes import inch
from reportlab.lib.utils import ImageReader
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


def generate_container_labels(batch_data: dict, containers: list) -> str:
    """Generate a multi-page B&W PDF, one page per container.

    batch_data: dict with grn_number, material_code, material_name, batch_number,
                pack_type, container_quantity, unit_of_measure, manufacture_date,
                expiry_date, supplier_name, manufacturer_name, batch_id.
    containers: list of dicts with container_number, unique_code, qr_code_path.

    Layout (4x6 portrait, B&W):
      Top center: "N / total"
      Left (~45% width): QR code
      Right: GRN, item code, item name, batch, pack, qty, dates, supplier, mfr
      Bottom center: unique_code
    """
    os.makedirs(settings.LABEL_DIR, exist_ok=True)

    filename = f"container_labels_{batch_data['batch_id']}.pdf"
    filepath = os.path.join(settings.LABEL_DIR, filename)

    width, height = 4 * inch, 6 * inch
    c = canvas.Canvas(filepath, pagesize=(width, height))
    total = len(containers)

    for cont in containers:
        c.setStrokeColor(colors.black)
        c.setLineWidth(2)
        c.rect(0.1 * inch, 0.1 * inch, width - 0.2 * inch, height - 0.2 * inch)

        # Top: label count
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 18)
        c.drawCentredString(
            width / 2,
            height - 0.55 * inch,
            f"{cont.get('container_number', '?')}  /  {total}",
        )
        c.setLineWidth(1)
        c.line(0.2 * inch, height - 0.75 * inch, width - 0.2 * inch, height - 0.75 * inch)

        # Left: QR — use file if present, otherwise generate in-memory (Render ephemeral FS)
        qr_path = cont.get("qr_code_path")
        unique_code = cont.get("unique_code", "")
        qr_src = None
        if qr_path and os.path.exists(qr_path):
            qr_src = qr_path
        elif unique_code:
            qr_obj = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_M,
                box_size=10,
                border=4,
            )
            qr_obj.add_data(f"QTRACK|CNT|{unique_code}")
            qr_obj.make(fit=True)
            buf = io.BytesIO()
            qr_obj.make_image(fill_color="black", back_color="white").save(buf, format='PNG')
            buf.seek(0)
            qr_src = ImageReader(buf)
        if qr_src:
            qr_size = 1.7 * inch
            qr_x = 0.2 * inch
            qr_y = (height - 0.75 * inch - 0.7 * inch) / 2 + 0.7 * inch - qr_size / 2
            c.drawImage(qr_src, qr_x, qr_y, qr_size, qr_size, preserveAspectRatio=True)

        # Right: details
        details_x = 2.0 * inch
        y = height - 1.00 * inch
        lh = 0.22 * inch

        per_container = batch_data.get("container_quantity") or ""
        unit = batch_data.get("unit_of_measure") or "KG"
        qty_str = f"{per_container} {unit}".strip() if per_container else ""

        fields = [
            ("GRN", str(batch_data.get("grn_number", ""))),
            ("Item Code", str(batch_data.get("material_code", ""))),
            ("Item", str(batch_data.get("material_name", ""))),
            ("Batch/Lot", str(batch_data.get("batch_number", ""))),
            ("Pack", str(batch_data.get("pack_type", ""))),
            ("Qty", qty_str),
            ("Mfg", str(batch_data.get("manufacture_date", ""))),
            ("Exp", str(batch_data.get("expiry_date", ""))),
            ("Supplier", str(batch_data.get("supplier_name", ""))),
            ("Mfr", str(batch_data.get("manufacturer_name", ""))),
        ]

        for label, value in fields:
            c.setFont("Helvetica-Bold", 7)
            c.drawString(details_x, y, f"{label}:")
            c.setFont("Helvetica", 8)
            # Wrap long values
            val = str(value or "")
            if len(val) > 22:
                val = val[:20] + "…"
            c.drawString(details_x + 0.45 * inch, y, val)
            y -= lh

        # Bottom center: unique_code
        c.setFont("Helvetica-Bold", 9)
        c.drawCentredString(
            width / 2,
            0.35 * inch,
            str(cont.get("unique_code", "")),
        )

        c.showPage()

    c.save()
    return filepath
