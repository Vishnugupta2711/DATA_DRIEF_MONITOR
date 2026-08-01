from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors

import pandas as pd
import io
import json
from datetime import datetime


# --------------------------------------------------
# Helpers
# --------------------------------------------------

def safe_json(val):
    try:
        return json.dumps(val, indent=2)
    except Exception:
        return str(val)


def format_float(x, digits=3):
    try:
        return round(float(x), digits)
    except Exception:
        return x


# --------------------------------------------------
# PDF REPORT GENERATION
# --------------------------------------------------

def generate_pdf(snapshot, user_email):
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    story = []

    # Title
    story.append(Paragraph("📊 <b>Data Drift Analysis Report</b>", styles["Title"]))
    story.append(Spacer(1, 12))

    # Metadata
    meta_table = [
        ["User", user_email],
        ["Dataset", snapshot.dataset_name],
        ["Timestamp", snapshot.timestamp.strftime("%Y-%m-%d %H:%M:%S") if snapshot.timestamp else ""],
        ["Drift Score", format_float(snapshot.drift_score)],
        ["Severity", snapshot.drift_severity],
    ]

    story.append(Table(meta_table, colWidths=[5 * cm, 10 * cm]))
    story.append(Spacer(1, 15))

    summary = snapshot.summary or {}

    # Drift Section
    story.append(Paragraph("🚨 <b>Detected Drift</b>", styles["Heading2"]))
    drift_items = summary.get("drift", [])

    if not drift_items:
        story.append(Paragraph("No drift detected.", styles["Normal"]))
    else:
        drift_rows = [["Type", "Details"]]
        for d in drift_items:
            if isinstance(d, dict):
                drift_rows.append([d.get("type", ""), safe_json(d)])
            else:
                drift_rows.append(["", str(d)])

        story.append(
            Table(
                drift_rows,
                repeatRows=1,
                style=TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ]
                ),
            )
        )

    story.append(Spacer(1, 12))

    # Data Quality Section
    quality = summary.get("quality_metrics")
    if quality:
        story.append(Paragraph("📈 <b>Data Quality</b>", styles["Heading2"]))
        quality_rows = [["Metric", "Value"]]
        for k, v in quality.items():
            quality_rows.append([k, format_float(v)])

        story.append(
            Table(
                quality_rows,
                repeatRows=1,
                style=TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ]
                ),
            )
        )
        story.append(Spacer(1, 12))

    # Feature Drift Section
    feature_drift = summary.get("drift_by_feature")
    if feature_drift:
        story.append(Paragraph("🧬 <b>Feature Drift</b>", styles["Heading2"]))
        feature_rows = [["Feature", "Drift Score"]]
        for f, s in sorted(feature_drift.items(), key=lambda x: x[1], reverse=True)[:15]:
            feature_rows.append([f, format_float(s)])

        story.append(
            Table(
                feature_rows,
                repeatRows=1,
                style=TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ]
                ),
            )
        )
        story.append(Spacer(1, 12))

    # Anomalies Section
    anomalies = summary.get("anomaly_report")
    if anomalies:
        story.append(Paragraph("🚨 <b>Anomaly Detection</b>", styles["Heading2"]))
        anomaly_rows = [["Feature", "Has Anomaly"]]
        for f, a in anomalies.items():
            anomaly_rows.append([f, "Yes" if a.get("has_anomalies") else "No"])

        story.append(
            Table(
                anomaly_rows,
                repeatRows=1,
                style=TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ]
                ),
            )
        )
        story.append(Spacer(1, 12))

    # Footer
    story.append(Spacer(1, 20))
    story.append(
        Paragraph(
            f"Generated on {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
            styles["Normal"],
        )
    )

    doc.build(story)
    buffer.seek(0)
    return buffer


# --------------------------------------------------
# CSV REPORT GENERATION
# --------------------------------------------------

def generate_csv(snapshot):
    rows = []

    rows.append({"section": "meta", "key": "dataset", "value": snapshot.dataset_name})
    rows.append({"section": "meta", "key": "timestamp", "value": snapshot.timestamp})
    rows.append({"section": "meta", "key": "drift_score", "value": snapshot.drift_score})
    rows.append({"section": "meta", "key": "severity", "value": snapshot.drift_severity})

    summary = snapshot.summary or {}

    for section, content in summary.items():
        if isinstance(content, dict):
            for k, v in content.items():
                rows.append(
                    {
                        "section": section,
                        "key": k,
                        "value": safe_json(v),
                    }
                )
        else:
            rows.append(
                {
                    "section": section,
                    "key": "",
                    "value": safe_json(content),
                }
            )

    df = pd.DataFrame(rows)
    output = io.StringIO()
    df.to_csv(output, index=False)
    output.seek(0)
    return output
