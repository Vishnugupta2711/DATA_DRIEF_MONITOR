# backend/core/analyzer.py
import pandas as pd

def analyze_csv(path: str) -> dict:
    df = pd.read_csv(path)

    summary = {
        "row_count": len(df),
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
            mean = float(series.mean())
            std = float(series.std())
            minv = float(series.min())
            maxv = float(series.max())

            col_info.update({
                "mean": mean,
                "std": std,
                "min": minv,
                "max": maxv,
                "top_values": None,
            })

            # 👇 This feeds the ML drift scorer
            summary["numeric"][col] = {
                "mean": mean,
                "std": std,
                "min": minv,
                "max": maxv,
            }

        else:
            top_vals = series.value_counts().head(5).to_dict()
            col_info.update({
                "top_values": top_vals,
                "mean": None,
                "std": None,
                "min": None,
                "max": None,
            })

        summary["columns"][col] = col_info

    return summary
