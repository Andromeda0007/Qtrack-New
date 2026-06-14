import io
import os
import qrcode
from reportlab.lib.pagesizes import inch, A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.lib import colors

from app.config import settings

_ASSETS_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "assets"))
_LOGO_PATH = os.path.join(_ASSETS_DIR, "inducare_logo.png")

_GREEN = colors.HexColor("#1a5c2a")
_DARK = colors.HexColor("#1a1a1a")
_RULE_C = colors.HexColor("#cccccc")
_HEADER_BG = colors.HexColor("#eef5f0")


def _fmt_date(raw: str, fmt: str) -> str:
    """Convert ISO date (YYYY-MM-DD) to chosen display format."""
    if not raw:
        return "—"
    s = str(raw).strip()
    p = s.split("-")
    if len(p) == 3:
        yr, mo, dy = p[0], p[1], p[2]
        f = (fmt or "DD-MM-YYYY").upper()
        if f == "DD-MM-YYYY":
            return f"{dy}-{mo}-{yr}"
        if f == "YYYY-MM-DD":
            return f"{yr}-{mo}-{dy}"
        if f == "MM-YYYY":
            return f"{mo}-{yr}"
    return s


def _make_batch_qr(public_code: str):
    """Return an ImageReader with QR encoding QTRACK|BATCH|{public_code}."""
    if not public_code:
        return None
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(f"QTRACK|BATCH|{public_code}")
    qr.make(fit=True)
    buf = io.BytesIO()
    qr.make_image(fill_color="black", back_color="white").save(buf, format="PNG")
    buf.seek(0)
    return ImageReader(buf)


def _draw_inducare_header(
    c: canvas.Canvas, lx: float, label_top: float, lw: float, hdr_h: float
) -> float:
    """Draw Inducare logo + 3-line company name in the header band.

    Returns the y coordinate of the header bottom (= body top).
    """
    hdr_bottom = label_top - hdr_h

    # Background
    c.setFillColor(_HEADER_BG)
    c.rect(lx + 0.75, hdr_bottom + 0.75, lw - 1.5, hdr_h - 0.75, fill=1, stroke=0)

    # Logo (left side) — 88% of header height gives proper top/bottom padding
    LOGO_H = hdr_h * 0.96
    LOGO_W = LOGO_H
    logo_x = lx + 0.34 * inch
    logo_y = hdr_bottom + (hdr_h - LOGO_H) / 2

    has_logo = False
    if os.path.exists(_LOGO_PATH):
        try:
            c.drawImage(
                _LOGO_PATH, logo_x, logo_y, LOGO_W, LOGO_H,
                preserveAspectRatio=True, mask="auto",
            )
            has_logo = True
        except Exception:
            pass

    # Vertical divider after logo
    logo_divider_x = logo_x + LOGO_W + 0.34 * inch
    c.setStrokeColor(_RULE_C)
    c.setLineWidth(1.0)
    c.line(logo_divider_x, hdr_bottom, logo_divider_x, label_top)

    # Company name (2 lines, centred in the space right of the divider)
    txt_cx = logo_divider_x + (lx + lw - 0.12 * inch - logo_divider_x) / 2

    c.setFillColor(_GREEN)
    c.setFont("Helvetica", 20)
    c.drawCentredString(txt_cx, hdr_bottom + hdr_h * 0.62, "Inducare Pharmaceuticals and Research")
    c.setFont("Helvetica", 20)
    c.drawCentredString(txt_cx, hdr_bottom + hdr_h * 0.26, "Foundation")

    # Divider below header
    c.setStrokeColor(_RULE_C)
    c.setLineWidth(1.0)
    c.line(lx, hdr_bottom, lx + lw, hdr_bottom)

    return hdr_bottom


def _draw_quarantine_label(
    c: canvas.Canvas,
    data: dict,
    lx: float,
    lb: float,
    lw: float,
    lh: float,
    label_num: int,
    total_labels: int,
):
    """Draw one complete Inducare quarantine label."""
    label_top = lb + lh
    label_right = lx + lw

    # Outer border
    c.setStrokeColor(_DARK)
    c.setLineWidth(1.0)
    c.rect(lx, lb, lw, lh)
    # Top edge thicker
    c.setLineWidth(1.5)
    c.line(lx, label_top, lx + lw, label_top)

    # Header (returns body_top)
    HDR_H = 1.10 * inch
    body_top = _draw_inducare_header(c, lx, label_top, lw, HDR_H)

    body_bottom = lb
    body_h = body_top - body_bottom

    # Column split: left 38% | right 62%
    DIV_X = lx + lw * 0.38

    c.setStrokeColor(_RULE_C)
    c.setLineWidth(1.0)
    c.line(DIV_X, body_top, DIV_X, body_bottom)

    # ── Left column ───────────────────────────────────────────────────────
    left_cx = lx + (DIV_X - lx) / 2

    # Label counter
    ctr_y = body_top - 0.60 * inch
    c.setFillColor(_DARK)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(left_cx, ctr_y, f"{label_num}  /  {total_labels}")

    # QR code (sized to fill available space with room for counter + dates)
    date_area_h = 0.65 * inch
    ctr_area_h = 0.38 * inch
    avail_qr_h = body_h - ctr_area_h - date_area_h
    max_qr_w = DIV_X - lx - 0.26 * inch
    QR_SZ = min(max_qr_w, avail_qr_h)
    qr_x = left_cx - QR_SZ / 2
    qr_y = body_bottom + date_area_h + (avail_qr_h - QR_SZ) / 2

    qr_src = _make_batch_qr(data.get("public_code", ""))
    if qr_src:
        c.drawImage(qr_src, qr_x, qr_y, QR_SZ, QR_SZ, preserveAspectRatio=True)

    # Mfg / Exp dates below QR
    dfmt = data.get("date_format", "DD-MM-YYYY")
    mfg = _fmt_date(data.get("manufacture_date", ""), dfmt)
    exp = _fmt_date(data.get("expiry_date", ""), dfmt)
    dy1 = body_bottom + date_area_h - 0.04 * inch
    dy2 = dy1 - 0.20 * inch
    c.setFillColor(_DARK)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(left_cx, dy1, f"Mfg:  {mfg}")
    c.drawCentredString(left_cx, dy2, f"Exp:  {exp}")

    # ── Right column ─────────────────────────────────────────────────────
    RC_X = DIV_X + 0.13 * inch
    RV_X = RC_X + 0.88 * inch
    RC_RIGHT = label_right - 0.10 * inch
    MAX_VAL_W = RC_RIGHT - RV_X
    LH = 0.255 * inch
    SEP_TOTAL = 0.26 * inch   # total vertical space consumed by each separator

    unit = data.get("unit", "")
    total_qty = f"{data.get('total_quantity', '')} {unit}".strip()
    cnt_qty = data.get("container_qty", "")
    pack_size_str = (
        f"{cnt_qty} {unit} / container".strip() if cnt_qty else ""
    )
    cnt_count = data.get("container_count", "")
    cnt_type = (data.get("pack_type", "") or "containers").upper()
    containers_str = f"{cnt_count} {cnt_type}".strip()

    sec1 = [
        ("Material",  data.get("material_name", "")),
        ("Item Code", data.get("material_code", "")),
        ("Batch No.", data.get("batch_number", "")),
        ("GRN",       data.get("grn_number", "")),
        ("GRN Date",  _fmt_date(data.get("grn_date", ""), dfmt)),
    ]
    sec2 = [
        ("Total Qty",  total_qty),
        ("Pack Size",  pack_size_str),
        ("Containers", containers_str),
    ]
    sec3 = [
        ("Manufacturer", data.get("manufacturer_name", "")),
        ("Supplier",     data.get("supplier_name", "")),
    ]

    n_rows = len(sec1) + len(sec2) + len(sec3)
    content_h = n_rows * LH + 2 * SEP_TOTAL
    y = body_top - (body_h - content_h) / 2 - LH * 0.5

    def row(cur_y, label, value):
        val = str(value or "—")
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(colors.HexColor("#555555"))
        c.drawString(RC_X, cur_y, f"{label}:")
        c.setFont("Helvetica", 11)
        c.setFillColor(_DARK)
        for _ in range(60):
            if c.stringWidth(val, "Helvetica", 11) <= MAX_VAL_W:
                break
            val = val[:-2] + "…"
        c.drawString(RV_X, cur_y, val)
        return cur_y - LH

    def sep(cur_y):
        # cur_y is LH below the last drawn row — compute true midpoint between sections
        last_row_y = cur_y + LH
        next_row_y = last_row_y - LH - SEP_TOTAL
        line_y = (last_row_y + next_row_y) / 2
        c.setStrokeColor(_RULE_C)
        c.setLineWidth(0.5)
        c.line(RC_X - 0.05 * inch, line_y, RC_RIGHT, line_y)
        return next_row_y

    for lbl, val in sec1:
        y = row(y, lbl, val)
    y = sep(y)
    for lbl, val in sec2:
        y = row(y, lbl, val)
    y = sep(y)
    for lbl, val in sec3:
        y = row(y, lbl, val)


def generate_quarantine_label(
    batch_data: dict, *, variant: str = "quarantine", count: int = 1
) -> str:
    """Generate an A4 PDF with count quarantine labels (2 per page).

    count=1 → 1 page with label "1/1" on top slot (bottom slot empty).
    count=100 → 50 pages, labels 1/100…100/100, 2 per page.
    variant is accepted for backward compatibility but does not alter the layout.
    """
    os.makedirs(settings.LABEL_DIR, exist_ok=True)

    suffix = f"_retest_{count}" if variant == "retest" else f"_{count}"
    filename = f"quarantine_label_{batch_data['batch_id']}{suffix}.pdf"
    filepath = os.path.join(settings.LABEL_DIR, filename)

    page_w, page_h = A4
    MARGIN = 0.3 * inch
    GAP = 0.3 * inch
    LABEL_W = page_w - 2 * MARGIN
    LABEL_H = (page_h - 2 * MARGIN - GAP) / 2

    # Slot bottom-y coordinates (top slot first so label 1 appears at top)
    slot_bottoms = [
        MARGIN + LABEL_H + GAP,  # slot 0 = top label
        MARGIN,                   # slot 1 = bottom label
    ]

    c = canvas.Canvas(filepath, pagesize=A4)

    for i in range(count):
        slot = i % 2
        _draw_quarantine_label(
            c,
            batch_data,
            lx=MARGIN,
            lb=slot_bottoms[slot],
            lw=LABEL_W,
            lh=LABEL_H,
            label_num=i + 1,
            total_labels=count,
        )
        # Emit page after filling both slots, or at the very last label
        if slot == 1 or i == count - 1:
            c.showPage()

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
        ("Product",   fg_data.get("product_name", "")),
        ("Batch No.", fg_data.get("batch_number", "")),
        ("Mfg Date",  str(fg_data.get("manufacture_date", ""))),
        ("Exp Date",  str(fg_data.get("expiry_date", ""))),
        ("Net Wt.",   str(fg_data.get("net_weight", "")) + " kg"),
        ("Gross Wt.", str(fg_data.get("gross_weight", "")) + " kg"),
        ("Quantity",  str(fg_data.get("quantity", ""))),
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
    """Return a ReportLab image source for a container QR code."""
    if qr_code_path and os.path.exists(qr_code_path):
        return qr_code_path
    if not unique_code:
        return None
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(f"QTRACK|CNT|{unique_code}")
    qr.make(fit=True)
    buf = io.BytesIO()
    qr.make_image(fill_color="black", back_color="white").save(buf, format="PNG")
    buf.seek(0)
    return ImageReader(buf)


def _draw_container_label(c, cont: dict, batch_data: dict, total: int, label_bottom: float):
    """Draw one container label with Inducare header. label_bottom = bottom y of label."""
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

    # Inducare header (replaces old "Container N / Total" bar)
    HDR_H = 0.78 * inch
    body_top = _draw_inducare_header(c, label_left, label_top, label_w, HDR_H)

    body_bottom = label_bottom + 0.15 * inch
    body_h = body_top - body_bottom

    # ── Left column: counter + QR + unique code ───────────────────────────
    divider_x = label_left + 3.1 * inch
    qr_col_center_x = label_left + (divider_x - label_left) / 2

    # Container counter at top of left column body
    ctr_y = body_top - 0.30 * inch
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(
        qr_col_center_x, ctr_y,
        f"Container  {cont.get('container_number', '?')}  /  {total}",
    )

    qr_size = 2.2 * inch
    ctr_area = 0.40 * inch
    code_area = 0.28 * inch
    avail = body_h - ctr_area - code_area
    qr_x = qr_col_center_x - qr_size / 2
    qr_y = body_bottom + code_area + (avail - qr_size) / 2

    qr_src = _make_qr_src(cont.get("unique_code", ""), cont.get("qr_code_path"))
    if qr_src:
        c.drawImage(qr_src, qr_x, qr_y, qr_size, qr_size, preserveAspectRatio=True)

    # Unique code below QR
    c.setFont("Helvetica-Bold", 7)
    c.setFillColor(colors.black)
    c.drawCentredString(qr_col_center_x, qr_y - 0.20 * inch, str(cont.get("unique_code", "")))

    # ── Vertical divider ─────────────────────────────────────────────────
    c.setStrokeColor(_RULE_C)
    c.setLineWidth(0.75)
    c.line(divider_x, body_top, divider_x, body_bottom)

    # ── Right column: details ─────────────────────────────────────────────
    details_x = divider_x + 0.20 * inch
    value_x = details_x + 1.0 * inch
    right_max_w = label_right - value_x - 0.1 * inch

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
    total_fields_h = len(fields) * lh
    y = body_top - (body_h - total_fields_h) / 2 - lh * 0.3

    for label, value in fields:
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(colors.black)
        c.drawString(details_x, y, f"{label}:")
        c.setFont("Helvetica", 9)
        val = str(value)
        if len(val) > 28:
            val = val[:26] + "…"
        c.drawString(value_x, y, val)
        y -= lh


def generate_container_labels(batch_data: dict, containers: list) -> str:
    """Generate an A4 PDF with 2 container labels per page."""
    os.makedirs(settings.LABEL_DIR, exist_ok=True)

    filename = f"container_labels_{batch_data['batch_id']}.pdf"
    filepath = os.path.join(settings.LABEL_DIR, filename)

    page_w, page_h = A4

    c = canvas.Canvas(filepath, pagesize=A4)
    total = len(containers)

    MARGIN = 0.2 * inch
    LABEL_H = 5.5 * inch
    GAP = page_h - 2 * LABEL_H - 2 * MARGIN
    label_bottoms = [
        MARGIN + LABEL_H + GAP,  # top label
        MARGIN,                   # bottom label
    ]

    for i, cont in enumerate(containers):
        slot = i % 2
        _draw_container_label(c, cont, batch_data, total, label_bottoms[slot])
        if slot == 1 or i == total - 1:
            c.showPage()

    c.save()
    return filepath
