import sys, os
sys.path.append(os.path.abspath("."))

from backend.core.analyzer import analyze_csv

summary = analyze_csv("data/raw/sales_day1.csv")
print(summary)
