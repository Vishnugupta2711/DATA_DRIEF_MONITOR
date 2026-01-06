from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from transformers import pipeline
import numpy as np

embedder = SentenceTransformer("all-MiniLM-L6-v2")
summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

def semantic_drift_score(old_texts, new_texts):
    emb_old = embedder.encode(old_texts)
    emb_new = embedder.encode(new_texts)

    sim = cosine_similarity(
        emb_old.mean(axis=0).reshape(1, -1),
        emb_new.mean(axis=0).reshape(1, -1),
    )[0][0]

    return float(1 - sim)


def generate_drift_summary(old_texts, new_texts):
    combined = (
        "Previous data:\n" + " ".join(old_texts[:20]) +
        "\n\nNew data:\n" + " ".join(new_texts[:20])
    )

    if len(combined) > 3500:
        combined = combined[:3500]

    result = summarizer(combined, max_length=150, min_length=60, do_sample=False)
    return result[0]["summary_text"]
