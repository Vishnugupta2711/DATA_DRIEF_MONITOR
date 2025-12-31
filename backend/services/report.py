from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
import pandas as pd
import io
import json
from datetime import datetime

def generate_pdf(snapshot, user_email):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)

    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, 800, "Data Drift Report")

    c.setFont("Helvetica", 12)
    c.drawString(50, 770, f"User: {user_email}")
    c.drawString(50, 750, f"Dataset: {snapshot.dataset_name}")
    c.drawString(50, 730, f"Timestamp: {snapshot.timestamp}")
    c.drawString(50, 710, f"Drift Score: {snapshot.drift_score}")
    c.drawString(50, 690, f"Severity: {snapshot.drift_severity}")

    c.drawString(50, 660, "Detected Drift:")
    y = 640

    drift_items = snapshot.summary.get("drift", [])
    if not drift_items:
        c.drawString(70, y, "- No drift detected")
    else:
        for d in drift_items:
            c.drawString(70, y, f"- {d}")
            y -= 20
            if y < 100:
                c.showPage()
                y = 750

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer


def generate_csv(snapshot):
    summary = snapshot.summary
    rows = []

    rows.append({"metric": "drift_score", "value": snapshot.drift_score})
    rows.append({"metric": "severity", "value": snapshot.drift_severity})

    for key, val in summary.items():
        rows.append({"metric": key, "value": json.dumps(val)})

    df = pd.DataFrame(rows)
    output = io.StringIO()
    df.to_csv(output, index=False)
    output.seek(0)
    return output
