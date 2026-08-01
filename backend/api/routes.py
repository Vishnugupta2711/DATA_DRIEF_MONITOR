# backend/api/routes.py

@app.post("/generate-summary/{snapshot_id}")
async def generate_summary(snapshot_id: str):
    """Generate AI summary for a snapshot on demand."""
    
    # Get snapshot from database
    snapshot = get_snapshot_from_db(snapshot_id)
    
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    
    # Extract data
    drift = snapshot.summary.get("drift", [])
    severity = snapshot.summary.get("severity", "unknown")
    
    # ✅ Generate GenAI insights
    try:
        summary = generate_executive_summary(drift, [], severity)
        explanation = explain_drift(drift, snapshot.summary)
        remediation = genai_remediation_func(drift, severity)
        
        # Update snapshot in database
        snapshot.summary["genai_summary"] = summary
        snapshot.summary["genai_explanation"] = explanation
        snapshot.summary["genai_remediation"] = remediation
        db.commit()
        
        return {
            "summary": summary,
            "explanation": explanation,
            "remediation": remediation
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GenAI failed: {str(e)}")
    
    # backend/api/routes.py

@app.post("/analyze")
async def analyze_dataset(...):
    # ... your drift detection code ...
    
    result = {
        "id": snapshot_id,
        "score": drift_score,
        "severity": severity,
        "drift": drift_items,
        "features_analyzed": len(columns),
        # ✅ Don't generate GenAI automatically
        "genai_summary": None,
        "genai_explanation": None,
        "genai_remediation": None
    }
    
    return result