from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import threading

_lock = threading.Lock()
_model = None

def _load_model():
    global _model
    if _model is None:
        with _lock:
            if _model is None:
                _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def semantic_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0

    try:
        model = _load_model()
        emb = model.encode([a, b])
        return float(cosine_similarity([emb[0]], [emb[1]])[0][0])
    except Exception as e:
        print("Semantic similarity error:", e)
        return 0.0
