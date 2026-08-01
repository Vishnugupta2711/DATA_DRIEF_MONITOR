# backend/core/analyzer.py
import pandas as pd
from backend.nlp.semantic_engine import semantic_drift_score, generate_drift_summary

def analyze_csv(path: str) -> dict:
    df = pd.read_csv(path)

    summary = {
        "columns": {},
        "numeric": {}
    }

    for col in df.columns:
        series = df[col]

        col_info = {
            "dtype": str(series.dtype),
            "missing_pct": float(series.isna().mean()),
            "unique_count": int(series.nunique())
        }

        if pd.api.types.is_numeric_dtype(series):
            col_info.update({
                "mean": float(series.mean()),
                "std": float(series.std()),
                "min": float(series.min()),
                "max": float(series.max()),
            })

            summary["numeric"][col] = {
                "mean": col_info["mean"],
                "std": col_info["std"],
                "min": col_info["min"],
                "max": col_info["max"],
            }
        else:
            col_info.update({
                "mean": None,
                "std": None,
                "min": None,
                "max": None,
            })

        summary["columns"][col] = col_info

    return summary

def extract_text_columns(df):
    texts = []
    for col in df.columns:
        if df[col].dtype == "object":
            texts.extend(df[col].dropna().astype(str).tolist())
    return texts
