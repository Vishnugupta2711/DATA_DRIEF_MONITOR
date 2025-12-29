# backend/core/analyzer.py

import pandas as pd

def analyze_csv(path: str) -> dict:
    """
    Reads a CSV file and extracts schema + basic statistics.
    Returns a dictionary describing the dataset.
    """

    df = pd.read_csv(path)

    summary = {
        "row_count": len(df),
        "columns": {}
    }

    for col in df.columns:
        series = df[col]

        col_info = {
            "dtype": str(series.dtype),
            "missing_pct": float(series.isna().mean()),
            "unique_count": int(series.nunique())
        }

        # Add numeric stats only if numeric
        if pd.api.types.is_numeric_dtype(series):
            col_info["mean"] = float(series.mean())
            col_info["std"] = float(series.std())
            col_info["min"] = float(series.min())
            col_info["max"] = float(series.max())
        else:
            col_info["mean"] = None
            col_info["std"] = None
            col_info["min"] = None
            col_info["max"] = None

        summary["columns"][col] = col_info

    return summary
