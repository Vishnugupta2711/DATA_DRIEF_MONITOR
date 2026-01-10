from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from transformers import pipeline
import numpy as np
import logging
from functools import lru_cache
from typing import List, Tuple, Dict, Optional
import warnings

# Suppress tokenizer warnings
warnings.filterwarnings("ignore", category=FutureWarning)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize models with error handling
try:
    embedder = SentenceTransformer("all-MiniLM-L6-v2")
    logger.info("✅ SentenceTransformer model loaded successfully")
except Exception as e:
    logger.error(f"Failed to load SentenceTransformer: {e}")
    embedder = None

try:
    # Use a lighter model for faster inference
    summarizer = pipeline(
        "summarization", 
        model="facebook/bart-large-cnn",
        device=-1  # Use CPU, change to 0 for GPU
    )
    logger.info("✅ Summarization model loaded successfully")
except Exception as e:
    logger.error(f"Failed to load summarization model: {e}")
    summarizer = None


def semantic_drift_score(old_texts: List[str], new_texts: List[str]) -> float:
    """
    Calculate semantic drift score between two text distributions.
    Returns a value between 0 (no drift) and 1 (maximum drift).
    
    Args:
        old_texts: List of text samples from old distribution
        new_texts: List of text samples from new distribution
        
    Returns:
        Float value representing drift score (0-1)
    """
    if not embedder:
        logger.warning("Embedder not available, returning default score")
        return 0.0
    
    if not old_texts or not new_texts:
        logger.warning("Empty text lists provided")
        return 0.0
    
    try:
        # Filter out empty strings and None values
        old_texts = [str(t).strip() for t in old_texts if t and str(t).strip()]
        new_texts = [str(t).strip() for t in new_texts if t and str(t).strip()]
        
        if not old_texts or not new_texts:
            return 0.0
        
        # Limit to reasonable sample sizes for performance
        max_samples = 1000
        if len(old_texts) > max_samples:
            old_texts = np.random.choice(old_texts, max_samples, replace=False).tolist()
        if len(new_texts) > max_samples:
            new_texts = np.random.choice(new_texts, max_samples, replace=False).tolist()
        
        # Encode texts
        logger.info(f"Encoding {len(old_texts)} old texts and {len(new_texts)} new texts")
        emb_old = embedder.encode(old_texts, show_progress_bar=False)
        emb_new = embedder.encode(new_texts, show_progress_bar=False)
        
        # Calculate mean embeddings
        mean_old = emb_old.mean(axis=0).reshape(1, -1)
        mean_new = emb_new.mean(axis=0).reshape(1, -1)
        
        # Cosine similarity
        sim = cosine_similarity(mean_old, mean_new)[0][0]
        
        # Convert to drift score (1 - similarity)
        drift = float(1 - sim)
        
        logger.info(f"Semantic drift score: {drift:.4f}")
        return drift
        
    except Exception as e:
        logger.error(f"Error calculating semantic drift: {e}")
        return 0.0


def semantic_drift_score_advanced(
    old_texts: List[str], 
    new_texts: List[str],
    method: str = "mean"
) -> Dict[str, float]:
    """
    Advanced semantic drift calculation with multiple metrics.
    
    Args:
        old_texts: List of text samples from old distribution
        new_texts: List of text samples from new distribution
        method: 'mean', 'median', or 'distribution'
        
    Returns:
        Dictionary with multiple drift metrics
    """
    if not embedder:
        return {"drift_score": 0.0, "confidence": 0.0}
    
    try:
        # Filter and sample
        old_texts = [str(t).strip() for t in old_texts if t and str(t).strip()]
        new_texts = [str(t).strip() for t in new_texts if t and str(t).strip()]
        
        if not old_texts or not new_texts:
            return {"drift_score": 0.0, "confidence": 0.0}
        
        # Encode
        emb_old = embedder.encode(old_texts[:500], show_progress_bar=False)
        emb_new = embedder.encode(new_texts[:500], show_progress_bar=False)
        
        # Mean-based drift
        mean_sim = cosine_similarity(
            emb_old.mean(axis=0).reshape(1, -1),
            emb_new.mean(axis=0).reshape(1, -1)
        )[0][0]
        
        # Pairwise similarity distribution
        pairwise_sims = []
        sample_size = min(100, len(emb_old), len(emb_new))
        old_sample = emb_old[:sample_size]
        new_sample = emb_new[:sample_size]
        
        for i in range(min(50, sample_size)):
            sim = cosine_similarity(
                old_sample[i].reshape(1, -1),
                new_sample[i].reshape(1, -1)
            )[0][0]
            pairwise_sims.append(sim)
        
        # Calculate metrics
        pairwise_mean = float(np.mean(pairwise_sims))
        pairwise_std = float(np.std(pairwise_sims))
        
        return {
            "drift_score": float(1 - mean_sim),
            "pairwise_drift": float(1 - pairwise_mean),
            "drift_variance": pairwise_std,
            "confidence": float(1 - pairwise_std),  # Lower variance = higher confidence
            "num_samples": len(old_texts) + len(new_texts)
        }
        
    except Exception as e:
        logger.error(f"Error in advanced semantic drift: {e}")
        return {"drift_score": 0.0, "confidence": 0.0}


def generate_drift_summary(
    old_texts: List[str], 
    new_texts: List[str],
    max_length: int = 150,
    min_length: int = 60
) -> str:
    """
    Generate a natural language summary of semantic drift.
    
    Args:
        old_texts: Previous data samples
        new_texts: New data samples
        max_length: Maximum summary length
        min_length: Minimum summary length
        
    Returns:
        Summary text explaining the drift
    """
    if not summarizer:
        logger.warning("Summarizer not available, returning fallback summary")
        return generate_fallback_summary(old_texts, new_texts)
    
    try:
        # Filter valid texts
        old_texts = [str(t).strip() for t in old_texts if t and str(t).strip()]
        new_texts = [str(t).strip() for t in new_texts if t and str(t).strip()]
        
        if not old_texts or not new_texts:
            return "Insufficient data for drift summary."
        
        # Sample texts for summary
        old_sample = " ".join(old_texts[:20])
        new_sample = " ".join(new_texts[:20])
        
        combined = (
            f"Previous data characteristics: {old_sample[:500]} "
            f"Current data characteristics: {new_sample[:500]}"
        )
        
        # Truncate to model's max length
        if len(combined) > 1024:
            combined = combined[:1024]
        
        # Generate summary
        result = summarizer(
            combined, 
            max_length=max_length, 
            min_length=min_length, 
            do_sample=False,
            truncation=True
        )
        
        summary = result[0]["summary_text"]
        logger.info(f"Generated summary: {summary[:100]}...")
        return summary
        
    except Exception as e:
        logger.error(f"Error generating summary: {e}")
        return generate_fallback_summary(old_texts, new_texts)


def generate_fallback_summary(old_texts: List[str], new_texts: List[str]) -> str:
    """
    Generate a rule-based summary when the model is unavailable.
    """
    try:
        # Basic statistics
        old_avg_len = np.mean([len(str(t).split()) for t in old_texts[:100]])
        new_avg_len = np.mean([len(str(t).split()) for t in new_texts[:100]])
        
        len_change = ((new_avg_len - old_avg_len) / old_avg_len * 100) if old_avg_len > 0 else 0
        
        # Generate summary
        if abs(len_change) > 20:
            direction = "increased" if len_change > 0 else "decreased"
            summary = f"Text length {direction} by {abs(len_change):.1f}%. "
        else:
            summary = "Text length remained relatively stable. "
        
        # Add semantic comparison
        drift_score = semantic_drift_score(old_texts[:100], new_texts[:100])
        
        if drift_score > 0.3:
            summary += "Significant semantic shift detected in the data distribution."
        elif drift_score > 0.15:
            summary += "Moderate semantic changes observed in the content."
        else:
            summary += "Content remains semantically consistent."
        
        return summary
        
    except Exception as e:
        logger.error(f"Error in fallback summary: {e}")
        return "Unable to generate drift summary due to data format issues."


@lru_cache(maxsize=100)
def get_cached_embedding(text: str):
    """Cache embeddings for frequently occurring texts."""
    if not embedder:
        return None
    try:
        return embedder.encode([text], show_progress_bar=False)[0]
    except:
        return None


def detect_vocabulary_shift(old_texts: List[str], new_texts: List[str]) -> Dict[str, any]:
    """
    Detect vocabulary-level changes between distributions.
    
    Returns:
        Dictionary with vocabulary statistics and drift indicators
    """
    try:
        # Extract vocabulary
        old_vocab = set()
        new_vocab = set()
        
        for text in old_texts[:500]:
            words = str(text).lower().split()
            old_vocab.update(words)
        
        for text in new_texts[:500]:
            words = str(text).lower().split()
            new_vocab.update(words)
        
        # Calculate metrics
        intersection = old_vocab & new_vocab
        union = old_vocab | new_vocab
        
        jaccard_similarity = len(intersection) / len(union) if union else 0
        new_words = new_vocab - old_vocab
        removed_words = old_vocab - new_vocab
        
        return {
            "jaccard_similarity": float(jaccard_similarity),
            "vocab_drift": float(1 - jaccard_similarity),
            "new_words_count": len(new_words),
            "removed_words_count": len(removed_words),
            "new_words_sample": list(new_words)[:20],
            "removed_words_sample": list(removed_words)[:20],
            "total_old_vocab": len(old_vocab),
            "total_new_vocab": len(new_vocab)
        }
        
    except Exception as e:
        logger.error(f"Error detecting vocabulary shift: {e}")
        return {
            "jaccard_similarity": 0.0,
            "vocab_drift": 0.0,
            "new_words_count": 0,
            "removed_words_count": 0
        }


def analyze_semantic_drift_comprehensive(
    old_texts: List[str], 
    new_texts: List[str]
) -> Dict[str, any]:
    """
    Comprehensive semantic drift analysis combining multiple methods.
    
    Returns:
        Dictionary with all drift metrics and analysis
    """
    try:
        # Basic drift score
        basic_drift = semantic_drift_score(old_texts, new_texts)
        
        # Advanced metrics
        advanced_metrics = semantic_drift_score_advanced(old_texts, new_texts)
        
        # Vocabulary analysis
        vocab_analysis = detect_vocabulary_shift(old_texts, new_texts)
        
        # Generate summary
        summary = generate_drift_summary(old_texts, new_texts)
        
        # Overall drift classification
        overall_drift = (basic_drift + vocab_analysis["vocab_drift"]) / 2
        
        if overall_drift > 0.5:
            severity = "high"
            recommendation = "Immediate review required. Significant semantic changes detected."
        elif overall_drift > 0.3:
            severity = "medium"
            recommendation = "Monitor closely. Notable semantic shifts observed."
        else:
            severity = "low"
            recommendation = "Semantic consistency maintained. Continue monitoring."
        
        return {
            "drift_score": float(basic_drift),
            "severity": severity,
            "recommendation": recommendation,
            "advanced_metrics": advanced_metrics,
            "vocabulary_analysis": vocab_analysis,
            "summary": summary,
            "timestamp": np.datetime64('now').astype(str)
        }
        
    except Exception as e:
        logger.error(f"Error in comprehensive analysis: {e}")
        return {
            "drift_score": 0.0,
            "severity": "unknown",
            "recommendation": "Analysis failed due to error",
            "error": str(e)
        }


# Health check function
def check_models_health() -> Dict[str, bool]:
    """Check if models are loaded and working."""
    return {
        "embedder_loaded": embedder is not None,
        "summarizer_loaded": summarizer is not None,
        "embedder_working": test_embedder(),
        "summarizer_working": test_summarizer()
    }


def test_embedder() -> bool:
    """Test if embedder is working."""
    if not embedder:
        return False
    try:
        embedder.encode(["test"], show_progress_bar=False)
        return True
    except:
        return False


def test_summarizer() -> bool:
    """Test if summarizer is working."""
    if not summarizer:
        return False
    try:
        summarizer("This is a test sentence.", max_length=20, min_length=5)
        return True
    except:
        return False