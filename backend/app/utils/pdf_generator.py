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


def _make_qr_src(unique_code: str, qr_code_path: str | None):
    """Return a ReportLab image source for the container QR code."""
    if qr_code_path and os.path.exists(qr_code_path):
        return qr_code_path
    if not unique_code:
        return None
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
    return ImageReader(buf)


def _draw_container_label(c, cont: dict, batch_data: dict, total: int, label_bottom: float):
    """Draw one container label. label_bottom is the y coordinate of the label's bottom edge."""
    MARGIN = 0.2 * inch
    PAGE_W = 8.27 * inch
    LABEL_H = 5.5 * inch

    label_left = MARGIN
    label_right = PAGE_W - MARGIN
    label_top = label_bottom + LABEL_H
    label_w = label_right - label_left

    # Outer border
    c.setStrokeColor(colors.black)
    c.setLineWidth(1.5)
    c.rect(label_left, label_bottom, label_w, LABEL_H)

    # ── Header: "N / Total" ──────────────────────────────────────────
    header_h = 0.55 * inch
    c.setFont("Helvetica-Bold", 16)
    c.setFillColor(colors.black)
    c.drawCentredString(
        label_left + label_w / 2,
        label_top - header_h + 0.12 * inch,
        f"Container  {cont.get('container_number', '?')}  /  {total}",
    )
    c.setLineWidth(1)
    c.line(label_left, label_top - header_h, label_right, label_top - header_h)

    # Body area (below header)
    body_top = label_top - header_h
    body_bottom = label_bottom + 0.15 * inch
    body_h = body_top - body_bottom

    # ── Left column: QR + unique code ───────────────────────────────
    divider_x = label_left + 3.1 * inch
    qr_col_center_x = label_left + (divider_x - label_left) / 2

    qr_size = 2.4 * inch
    qr_x = qr_col_center_x - qr_size / 2
    qr_y = body_bottom + (body_h - qr_size) / 2 + 0.2 * inch  # slightly above center (room for code below)

    qr_src = _make_qr_src(cont.get("unique_code", ""), cont.get("qr_code_path"))
    if qr_src:
        c.drawImage(qr_src, qr_x, qr_y, qr_size, qr_size, preserveAspectRatio=True)

    # Unique code below QR
    c.setFont("Helvetica-Bold", 7)
    c.setFillColor(colors.black)
    c.drawCentredString(qr_col_center_x, qr_y - 0.22 * inch, str(cont.get("unique_code", "")))

    # ── Vertical divider ─────────────────────────────────────────────
    c.setLineWidth(0.75)
    c.line(divider_x, body_top, divider_x, body_bottom)

    # ── Right column: details ────────────────────────────────────────
    details_x = divider_x + 0.2 * inch
    value_x = details_x + 1.0 * inch
    right_max_w = label_right - value_x - 0.1 * inch  # max chars width

    per_container = batch_data.get("container_quantity") or ""
    unit = batch_data.get("unit_of_measure") or "KG"
    qty_str = f"{per_container} {unit}".strip() if per_container else ""

    fields = [
        ("GRN",       str(batch_data.get("grn_number", "") or "")),
        ("Item Code", str(batch_data.get("material_code", "") or "")),
        ("Item",      str(batch_data.get("material_name", "") or "")),
        ("Batch/Lot", str(batch_data.get("batch_number", "") or "")),
        ("Pack",      str(batch_data.get("pack_type", "") or "")),
        ("Qty",       qty_str),
        ("Mfg Date",  str(batch_data.get("manufacture_date", "") or "")),
        ("Exp Date",  str(batch_data.get("expiry_date", "") or "")),
        ("Supplier",  str(batch_data.get("supplier_name", "") or "")),
        ("Mfr",       str(batch_data.get("manufacturer_name", "") or "")),
    ]

    lh = 0.29 * inch
    # Start fields vertically centered in the body
    total_fields_h = len(fields) * lh
    y = body_top - (body_h - total_fields_h) / 2 - lh * 0.3

    for label, value in fields:
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(colors.black)
        c.drawString(details_x, y, f"{label}:")
        c.setFont("Helvetica", 9)
        val = str(value)
        # Truncate if too long (~28 chars fits in right column at 9pt)
        if len(val) > 28:
            val = val[:26] + "…"
        c.drawString(value_x, y, val)
        y -= lh


def generate_container_labels(batch_data: dict, containers: list) -> str:
    """Generate an A4 PDF with 2 container labels per page.

    Each label: QR code on the left, details on the right.
    batch_data keys: grn_number, material_code, material_name, batch_number,
                     pack_type, container_quantity, unit_of_measure, manufacture_date,
                     expiry_date, supplier_name, manufacturer_name, batch_id.
    containers: list of dicts with container_number, unique_code, qr_code_path.
    """
    os.makedirs(settings.LABEL_DIR, exist_ok=True)

    filename = f"container_labels_{batch_data['batch_id']}.pdf"
    filepath = os.path.join(settings.LABEL_DIR, filename)

    from reportlab.lib.pagesizes import A4
    page_w, page_h = A4  # 595.28 pt × 841.89 pt  ≈  8.27" × 11.69"

    c = canvas.Canvas(filepath, pagesize=A4)
    total = len(containers)

    # Two label positions per A4 page (bottom edges, in points from page bottom)
    MARGIN = 0.2 * inch
    LABEL_H = 5.5 * inch
    GAP = page_h - 2 * LABEL_H - 2 * MARGIN  # ~0.19"
    label_bottoms = [
        MARGIN + LABEL_H + GAP,  # top label
        MARGIN,                   # bottom label
    ]

    for i, cont in enumerate(containers):
        slot = i % 2  # 0 = top, 1 = bottom
        _draw_container_label(c, cont, batch_data, total, label_bottoms[slot])
        # Emit page after filling both slots (or at the very last container)
        if slot == 1 or i == total - 1:
            c.showPage()

    c.save()
    return filepath
