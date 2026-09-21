"""Institutional PDF Performance & Defense Report Generator (§14, §44).

Generates a vector-based, multi-page executive report using ReportLab:
1. Executive Performance Summary (Valuation, P&L, Benchmark comparison)
2. Playbook Defense & Alpha Audit Log (Stops respected, trims banked, alpha protected)
3. Active Holdings Health Matrix (Price, day return, weight, 5-point score, RSI, SMA status)
4. Risk & Sector Concentration Breakdown (Guideline compliance, cash reserves)
"""
from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from .models import Holding
from .store import get_alert_history


from reportlab.pdfgen import canvas


class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically compute total page count."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_footer(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_footer(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        self.drawString(36, 24, "Atlas Portfolio Intelligence — Institutional Defense & Performance Report")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(A4[0] - 36, 24, page_text)
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(36, 36, A4[0] - 36, 36)
        self.restoreState()


def generate_weekly_performance_pdf(
    summary_data: dict[str, Any],
    holdings: list[Holding],
    history_entries: list[dict[str, Any]] | None = None,
    audit_kpis: dict[str, Any] | None = None,
) -> bytes:
    """Generate a publication-grade PDF report and return the raw bytes."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=44,
    )

    styles = getSampleStyleSheet()

    # Custom typography styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0f172a"),
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#64748b"),
    )
    h2_style = ParagraphStyle(
        "Heading2_Custom",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=17,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=10,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "Body_Custom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#334155"),
    )
    body_bold = ParagraphStyle(
        "Body_Bold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#0f172a"),
    )
    kpi_label = ParagraphStyle(
        "KpiLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#64748b"),
        alignment=1,  # Center
    )
    kpi_val = ParagraphStyle(
        "KpiVal",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#0f172a"),
        alignment=1,  # Center
    )

    story = []

    # 1. Header Banner
    now_str = datetime.now(timezone.utc).strftime("%A, %B %d, %Y — %H:%M UTC")
    header_table_data = [
        [
            Paragraph("ATLAS PORTFOLIO INTELLIGENCE", ParagraphStyle("Brand", fontName="Helvetica-Bold", fontSize=9, textColor=colors.HexColor("#0284c7"))),
            Paragraph(f"REPORT DATE: {now_str}", ParagraphStyle("DateMeta", fontName="Helvetica", fontSize=8, textColor=colors.HexColor("#64748b"), alignment=2)),
        ],
        [
            Paragraph("Executive Performance & Defense Report", title_style),
            Paragraph("STATUS: <font color='#059669'><b>LIVE DEFENSE ACTIVE</b></font>", ParagraphStyle("StatusMeta", fontName="Helvetica-Bold", fontSize=8.5, alignment=2)),
        ],
        [
            Paragraph("Comprehensive weekly review of portfolio returns, tactical trigger events, and risk limits.", subtitle_style),
            "",
        ]
    ]
    t_header = Table(header_table_data, colWidths=[360, 163])
    t_header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
    ]))
    story.append(t_header)
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0284c7"), spaceAfter=12))

    # 2. Executive KPI Cards
    tot_val = float(summary_data.get("total_value", 0.0) or 0.0)
    day_pnl = float(summary_data.get("day_pnl", 0.0) or 0.0)
    day_ret = float(summary_data.get("day_return", 0.0) or 0.0) * 100.0
    unreal_pnl = float(summary_data.get("unrealized_pnl", 0.0) or 0.0)
    cash_val = float(summary_data.get("cash", 0.0) or 0.0)
    cash_pct = (cash_val / tot_val * 100.0) if tot_val > 0 else 0.0

    pnl_color = "#059669" if day_pnl >= 0 else "#dc2626"
    pnl_sign = "+" if day_pnl >= 0 else ""

    kpi_card_style = ParagraphStyle("KpiValPnl", parent=kpi_val, textColor=colors.HexColor(pnl_color))

    kpi_matrix = [
        [
            Paragraph("TOTAL PORTFOLIO VALUE", kpi_label),
            Paragraph("TODAY'S NET P&L", kpi_label),
            Paragraph("UNREALIZED GAIN/LOSS", kpi_label),
            Paragraph("CASH ALLOCATION", kpi_label),
        ],
        [
            Paragraph(f"${tot_val:,.2f}", kpi_val),
            Paragraph(f"{pnl_sign}${day_pnl:,.2f} ({pnl_sign}{day_ret:.2f}%)", kpi_card_style),
            Paragraph(f"${unreal_pnl:,.2f}", kpi_val),
            Paragraph(f"${cash_val:,.2f} ({cash_pct:.1f}%)", kpi_val),
        ]
    ]
    t_kpis = Table(kpi_matrix, colWidths=[130, 131, 131, 131])
    t_kpis.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(t_kpis)
    story.append(Spacer(1, 14))

    # 3. Section: Playbook Defense & Alpha Audit Log
    story.append(Paragraph("1. Playbook Defense & Alpha Audit Summary", h2_style))
    history_entries = history_entries or get_alert_history(limit=25)
    total_events = len(history_entries)
    acted_events = [e for e in history_entries if str(e.get("action_taken", "")).upper() not in ("PENDING", "IGNORED", "")]
    action_rate = (len(acted_events) / total_events * 100.0) if total_events > 0 else 0.0
    alpha_saved = sum(float(e.get("alpha_saved_or_locked", 0.0) or 0.0) for e in history_entries)

    defense_summary_text = (
        f"<b>Audit Overview:</b> The Atlas defense engine logged <b>{total_events} trigger events</b> across portfolio holdings. "
        f"The disciplined action rate is <b>{action_rate:.1f}%</b>, resulting in an estimated "
        f"<b><font color='#059669'>+${alpha_saved:,.2f}</font></b> in drawdowns prevented and profits secured."
    )
    story.append(Paragraph(defense_summary_text, body_style))
    story.append(Spacer(1, 6))

    if history_entries:
        hist_table_data = [
            [
                Paragraph("<b>SYMBOL</b>", body_bold),
                Paragraph("<b>ALERT TITLE</b>", body_bold),
                Paragraph("<b>CATEGORY</b>", body_bold),
                Paragraph("<b>TRIGGER PRICE</b>", body_bold),
                Paragraph("<b>ACTION TAKEN</b>", body_bold),
                Paragraph("<b>ALPHA SAVED</b>", body_bold),
                Paragraph("<b>DATE</b>", body_bold),
            ]
        ]
        for e in history_entries[:8]:
            sym = e.get("symbol", "PORTFOLIO")
            title = e.get("title", "Alert")
            cat = e.get("category", "TRIGGER").replace("_", " ")
            trig_p = float(e.get("trigger_value", 0.0) or 0.0)
            act = str(e.get("action_taken", "PENDING")).upper()
            act_color = "#059669" if act in ("TRIMMED", "STOPPED_OUT_CASH", "ACKNOWLEDGED") else "#64748b"
            alpha_item = float(e.get("alpha_saved_or_locked", 0.0) or 0.0)
            dt_raw = e.get("triggered_at", "")[:10]

            hist_table_data.append([
                Paragraph(f"<b>{sym}</b>", body_style),
                Paragraph(title[:24], body_style),
                Paragraph(cat[:14], body_style),
                Paragraph(f"${trig_p:.2f}" if trig_p > 0 else "—", body_style),
                Paragraph(f"<font color='{act_color}'><b>{act}</b></font>", body_style),
                Paragraph(f"+${alpha_item:,.0f}" if alpha_item > 0 else "—", body_style),
                Paragraph(dt_raw, body_style),
            ])

        t_hist = Table(hist_table_data, colWidths=[55, 110, 85, 75, 95, 60, 43])
        t_hist.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(t_hist)
    else:
        story.append(Paragraph("<i>No triggered alert events recorded in current audit window. Capital defense boundaries fully active.</i>", body_style))

    story.append(Spacer(1, 14))

    # 4. Section: Holdings Health & Technical Matrix
    story.append(Paragraph("2. Active Holdings Technical Health & Conviction Matrix", h2_style))
    stock_holdings = [h for h in holdings if h.symbol != "CASH"]

    holdings_table_data = [
        [
            Paragraph("<b>TICKER</b>", body_bold),
            Paragraph("<b>COMPANY</b>", body_bold),
            Paragraph("<b>QUANTITY</b>", body_bold),
            Paragraph("<b>PRICE</b>", body_bold),
            Paragraph("<b>DAY %</b>", body_bold),
            Paragraph("<b>WEIGHT</b>", body_bold),
            Paragraph("<b>RSI</b>", body_bold),
            Paragraph("<b>TREND</b>", body_bold),
        ]
    ]

    for h in stock_holdings[:16]:
        sym = h.symbol
        name = h.name[:18] if h.name else sym
        qty = f"{h.quantity:,.1f}"
        price = f"${h.price:,.2f}"
        day_chg = h.day_change
        day_chg_str = f"{'+' if day_chg >= 0 else ''}{day_chg:.1f}%"
        day_chg_color = "#059669" if day_chg >= 0 else "#dc2626"
        weight_str = f"{h.weight:.1f}%"
        rsi_val = f"{h.rsi:.1f}"

        trend_status = "BULLISH" if (h.above_sma_50 and h.above_sma_200) else ("NEUTRAL" if h.above_sma_50 else "DEFENSE")
        trend_color = "#059669" if trend_status == "BULLISH" else ("#0284c7" if trend_status == "NEUTRAL" else "#dc2626")

        holdings_table_data.append([
            Paragraph(f"<b>{sym}</b>", body_style),
            Paragraph(name, body_style),
            Paragraph(qty, body_style),
            Paragraph(price, body_style),
            Paragraph(f"<font color='{day_chg_color}'><b>{day_chg_str}</b></font>", body_style),
            Paragraph(weight_str, body_style),
            Paragraph(rsi_val, body_style),
            Paragraph(f"<font color='{trend_color}'><b>{trend_status}</b></font>", body_style),
        ])

    t_holdings = Table(holdings_table_data, colWidths=[55, 120, 58, 65, 55, 50, 45, 75])
    t_holdings.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(t_holdings)
    story.append(Spacer(1, 14))

    # 5. Section: Sector Exposure & Concentration Risk
    story.append(Paragraph("3. Sector Allocation & Concentration Guardrails", h2_style))
    sector_weights: dict[str, float] = {}
    for h in stock_holdings:
        sec = h.sector or "Uncategorized"
        sector_weights[sec] = sector_weights.get(sec, 0.0) + h.weight

    sorted_sectors = sorted(sector_weights.items(), key=lambda x: x[1], reverse=True)

    sec_table_data = [
        [
            Paragraph("<b>SECTOR</b>", body_bold),
            Paragraph("<b>CURRENT WEIGHT</b>", body_bold),
            Paragraph("<b>RISK THRESHOLD</b>", body_bold),
            Paragraph("<b>COMPLIANCE STATUS</b>", body_bold),
        ]
    ]

    for sec, w in sorted_sectors[:6]:
        status_text = "OVERWEIGHT (>25%)" if w >= 25.0 else "OPTIMAL"
        status_col = "#dc2626" if w >= 25.0 else "#059669"
        sec_table_data.append([
            Paragraph(sec, body_style),
            Paragraph(f"<b>{w:.1f}%</b>", body_style),
            Paragraph("25.0% Max Guideline", body_style),
            Paragraph(f"<font color='{status_col}'><b>{status_text}</b></font>", body_style),
        ])

    t_sectors = Table(sec_table_data, colWidths=[180, 110, 110, 123])
    t_sectors.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(t_sectors)

    # Build PDF with dynamic page numbering
    doc.build(story, canvasmaker=NumberedCanvas)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
