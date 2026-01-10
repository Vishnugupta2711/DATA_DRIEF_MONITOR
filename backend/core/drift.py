# backend/core/drift.py

from scipy.stats import ks_2samp, chi2_contingency, mannwhitneyu
from scipy.spatial.distance import jensenshannon
import numpy as np
import logging
from typing import List, Dict, Tuple, Optional, Any
from backend.nlp.semantic_engine import (
    semantic_drift_score, 
    generate_drift_summary,
    detect_vocabulary_shift
)

logger = logging.getLogger(__name__)


def detect_numeric_drift(
    old_col: dict, 
    new_col: dict, 
    threshold: float = 0.1,
    method: str = "relative"
) -> Tuple[bool, float, str]:
    """
    Detect numeric drift with multiple detection methods.
    
    Args:
        old_col: Old column statistics
        new_col: New column statistics
        threshold: Drift threshold (default 0.1 = 10%)
        method: Detection method ('relative', 'absolute', 'zscore')
        
    Returns:
        Tuple of (drift_detected, drift_magnitude, drift_type)
    """
    try:
        old_mean = old_col.get("mean")
        new_mean = new_col.get("mean")
        old_std = old_col.get("std", 0)
        new_std = new_col.get("std", 0)
        
        if old_mean is None or new_mean is None:
            return False, 0.0, "no_data"
        
        # Prevent division by zero
        if old_mean == 0:
            if new_mean == 0:
                return False, 0.0, "both_zero"
            else:
                # Absolute change when old mean is zero
                return abs(new_mean) > threshold, abs(new_mean), "absolute_from_zero"
        
        # Method 1: Relative change (default)
        if method == "relative":
            relative_change = abs(new_mean - old_mean) / abs(old_mean)
            drift_detected = relative_change > threshold
            return drift_detected, relative_change, "relative_mean_shift"
        
        # Method 2: Absolute change
        elif method == "absolute":
            absolute_change = abs(new_mean - old_mean)
            drift_detected = absolute_change > threshold
            return drift_detected, absolute_change, "absolute_mean_shift"
        
        # Method 3: Z-score based (standardized difference)
        elif method == "zscore":
            if old_std > 0:
                z_score = abs(new_mean - old_mean) / old_std
                drift_detected = z_score > 2.0  # 2 standard deviations
                return drift_detected, z_score, "zscore_shift"
            else:
                relative_change = abs(new_mean - old_mean) / abs(old_mean)
                drift_detected = relative_change > threshold
                return drift_detected, relative_change, "relative_mean_shift"
        
        else:
            logger.warning(f"Unknown method '{method}', using relative")
            relative_change = abs(new_mean - old_mean) / abs(old_mean)
            drift_detected = relative_change > threshold
            return drift_detected, relative_change, "relative_mean_shift"
            
    except Exception as e:
        logger.error(f"Error detecting numeric drift: {e}")
        return False, 0.0, "error"


def detect_variance_drift(
    old_col: dict, 
    new_col: dict, 
    threshold: float = 0.3
) -> Tuple[bool, float]:
    """
    Detect changes in variance/spread of data.
    
    Args:
        old_col: Old column statistics
        new_col: New column statistics
        threshold: Relative change threshold for variance
        
    Returns:
        Tuple of (drift_detected, relative_variance_change)
    """
    try:
        old_std = old_col.get("std", 0)
        new_std = new_col.get("std", 0)
        
        if old_std is None or new_std is None:
            return False, 0.0
        
        if old_std == 0:
            return new_std > 0, float('inf') if new_std > 0 else 0.0
        
        relative_change = abs(new_std - old_std) / old_std
        drift_detected = relative_change > threshold
        
        return drift_detected, relative_change
        
    except Exception as e:
        logger.error(f"Error detecting variance drift: {e}")
        return False, 0.0


def detect_distribution_drift(
    old_col: dict, 
    new_col: dict,
    significance_level: float = 0.05
) -> Tuple[bool, float, str]:
    """
    Detect distribution changes using statistical tests.
    Uses Kolmogorov-Smirnov test for continuous data.
    
    Args:
        old_col: Old column statistics
        new_col: New column statistics
        significance_level: P-value threshold
        
    Returns:
        Tuple of (drift_detected, p_value, test_name)
    """
    try:
        # Extract distribution samples if available
        old_sample = old_col.get("sample_values", [])
        new_sample = new_col.get("sample_values", [])
        
        if not old_sample or not new_sample:
            # Fallback: simulate from mean and std
            old_mean = old_col.get("mean", 0)
            old_std = old_col.get("std", 1)
            new_mean = new_col.get("mean", 0)
            new_std = new_col.get("std", 1)
            
            if old_std > 0 and new_std > 0:
                old_sample = np.random.normal(old_mean, old_std, 100)
                new_sample = np.random.normal(new_mean, new_std, 100)
            else:
                return False, 1.0, "insufficient_data"
        
        # Kolmogorov-Smirnov test
        statistic, p_value = ks_2samp(old_sample, new_sample)
        drift_detected = p_value < significance_level
        
        return drift_detected, float(p_value), "kolmogorov_smirnov"
        
    except Exception as e:
        logger.error(f"Error in distribution drift test: {e}")
        return False, 1.0, "error"


def detect_categorical_drift(
    old_col: dict, 
    new_col: dict,
    threshold: float = 0.2
) -> Tuple[bool, float, List[str]]:
    """
    Detect drift in categorical columns.
    
    Args:
        old_col: Old column statistics
        new_col: New column statistics
        threshold: Jaccard similarity threshold
        
    Returns:
        Tuple of (drift_detected, jaccard_distance, changes_list)
    """
    try:
        old_unique = set(old_col.get("unique_values", []))
        new_unique = set(new_col.get("unique_values", []))
        
        if not old_unique or not new_unique:
            return False, 0.0, []
        
        # Jaccard similarity
        intersection = old_unique & new_unique
        union = old_unique | new_unique
        
        jaccard_similarity = len(intersection) / len(union) if union else 1.0
        jaccard_distance = 1 - jaccard_similarity
        
        # Identify changes
        changes = []
        new_categories = new_unique - old_unique
        removed_categories = old_unique - new_unique
        
        if new_categories:
            changes.append(f"New categories: {', '.join(list(new_categories)[:5])}")
        if removed_categories:
            changes.append(f"Removed categories: {', '.join(list(removed_categories)[:5])}")
        
        drift_detected = jaccard_distance > threshold
        
        return drift_detected, jaccard_distance, changes
        
    except Exception as e:
        logger.error(f"Error detecting categorical drift: {e}")
        return False, 0.0, []


def detect_missing_value_drift(
    old_col: dict, 
    new_col: dict, 
    threshold: float = 0.1
) -> Tuple[bool, float]:
    """
    Detect changes in missing value patterns.
    
    Args:
        old_col: Old column statistics
        new_col: New column statistics
        threshold: Absolute change threshold in missing percentage
        
    Returns:
        Tuple of (drift_detected, absolute_change)
    """
    try:
        old_missing = old_col.get("missing_pct", 0.0)
        new_missing = new_col.get("missing_pct", 0.0)
        
        absolute_change = abs(new_missing - old_missing)
        drift_detected = absolute_change > threshold
        
        return drift_detected, absolute_change
        
    except Exception as e:
        logger.error(f"Error detecting missing value drift: {e}")
        return False, 0.0


def detect_outlier_drift(
    old_col: dict, 
    new_col: dict
) -> Tuple[bool, Dict[str, Any]]:
    """
    Detect changes in outlier patterns.
    
    Args:
        old_col: Old column statistics
        new_col: New column statistics
        
    Returns:
        Tuple of (drift_detected, outlier_info)
    """
    try:
        old_min = old_col.get("min")
        old_max = old_col.get("max")
        new_min = new_col.get("min")
        new_max = new_col.get("max")
        
        if None in [old_min, old_max, new_min, new_max]:
            return False, {}
        
        # Check if new values are outside old range
        range_expansion = False
        outlier_info = {}
        
        if new_min < old_min:
            range_expansion = True
            outlier_info["new_lower_bound"] = float(new_min)
            outlier_info["old_lower_bound"] = float(old_min)
        
        if new_max > old_max:
            range_expansion = True
            outlier_info["new_upper_bound"] = float(new_max)
            outlier_info["old_upper_bound"] = float(old_max)
        
        return range_expansion, outlier_info
        
    except Exception as e:
        logger.error(f"Error detecting outlier drift: {e}")
        return False, {}


def detect_schema_drift(old: dict, new: dict) -> List[str]:
    """
    Detect schema-level changes (column additions/removals).
    
    Args:
        old: Old dataset summary
        new: New dataset summary
        
    Returns:
        List of drift messages
    """
    drift = []
    
    try:
        old_columns = set(old.get("columns", {}).keys())
        new_columns = set(new.get("columns", {}).keys())
        
        # New columns
        added = new_columns - old_columns
        for col in sorted(added):
            drift.append(f"➕ New column: {col}")
        
        # Removed columns
        removed = old_columns - new_columns
        for col in sorted(removed):
            drift.append(f"➖ Removed column: {col}")
        
        # Type changes
        for col in old_columns & new_columns:
            old_type = old["columns"][col].get("type", "unknown")
            new_type = new["columns"][col].get("type", "unknown")
            
            if old_type != new_type:
                drift.append(f"🔄 Type changed in {col}: {old_type} → {new_type}")
        
    except Exception as e:
        logger.error(f"Error detecting schema drift: {e}")
    
    return drift


def detect_statistical_drift(
    old: dict, 
    new: dict,
    thresholds: Optional[Dict[str, float]] = None
) -> List[str]:
    """
    Comprehensive statistical drift detection.
    
    Args:
        old: Old dataset summary
        new: New dataset summary
        thresholds: Custom thresholds for different drift types
        
    Returns:
        List of drift messages
    """
    if thresholds is None:
        thresholds = {
            "numeric_mean": 0.1,
            "variance": 0.3,
            "missing_rate": 0.1,
            "categorical": 0.2
        }
    
    drift = []
    
    try:
        for col, new_info in new.get("columns", {}).items():
            if col not in old.get("columns", {}):
                continue
            
            old_info = old["columns"][col]
            col_type = new_info.get("type", "unknown")
            
            # Numeric drift detection
            if col_type in ["int", "float", "numeric"]:
                # Mean drift
                mean_drift, magnitude, drift_type = detect_numeric_drift(
                    old_info, new_info, thresholds["numeric_mean"]
                )
                if mean_drift:
                    drift.append(
                        f"📊 Mean drift in {col}: {magnitude:.2%} change ({drift_type})"
                    )
                
                # Variance drift
                var_drift, var_change = detect_variance_drift(
                    old_info, new_info, thresholds["variance"]
                )
                if var_drift:
                    drift.append(
                        f"📈 Variance drift in {col}: {var_change:.2%} change"
                    )
                
                # Distribution drift
                dist_drift, p_value, test_name = detect_distribution_drift(old_info, new_info)
                if dist_drift:
                    drift.append(
                        f"📉 Distribution drift in {col} (p={p_value:.4f}, {test_name})"
                    )
                
                # Outlier drift
                outlier_drift, outlier_info = detect_outlier_drift(old_info, new_info)
                if outlier_drift:
                    drift.append(f"⚠️ Outlier pattern change in {col}")
            
            # Categorical drift detection
            elif col_type in ["str", "object", "categorical"]:
                cat_drift, distance, changes = detect_categorical_drift(
                    old_info, new_info, thresholds["categorical"]
                )
                if cat_drift:
                    drift.append(
                        f"🏷️ Categorical drift in {col}: {distance:.2%} dissimilarity"
                    )
                    drift.extend([f"  ├─ {change}" for change in changes])
            
            # Missing value drift (applies to all types)
            missing_drift, missing_change = detect_missing_value_drift(
                old_info, new_info, thresholds["missing_rate"]
            )
            if missing_drift:
                drift.append(
                    f"❓ Missing rate drift in {col}: "
                    f"{old_info.get('missing_pct', 0):.1%} → "
                    f"{new_info.get('missing_pct', 0):.1%}"
                )
        
    except Exception as e:
        logger.error(f"Error in statistical drift detection: {e}")
    
    return drift


def detect_semantic_drift(
    old_summary: dict, 
    new_summary: dict,
    thresholds: Optional[Dict[str, float]] = None
) -> Tuple[List[str], Optional[str], float]:
    """
    Enhanced semantic drift detection with vocabulary analysis.
    
    Args:
        old_summary: Old dataset summary
        new_summary: New dataset summary
        thresholds: Custom thresholds
        
    Returns:
        Tuple of (drift_messages, explanation, drift_score)
    """
    if thresholds is None:
        thresholds = {
            "semantic_score": 0.4,
            "vocabulary": 0.3,
            "summary_threshold": 0.25
        }
    
    drift = []
    explanation = None
    score = 0.0
    
    try:
        old_text = old_summary.get("text_sample", [])
        new_text = new_summary.get("text_sample", [])
        
        if not old_text or not new_text:
            logger.warning("No text samples available for semantic drift detection")
            return [], None, 0.0
        
        # Calculate semantic drift score
        score = semantic_drift_score(old_text, new_text)
        
        # Vocabulary shift analysis
        vocab_analysis = detect_vocabulary_shift(old_text, new_text)
        vocab_drift = vocab_analysis.get("vocab_drift", 0.0)
        
        # Semantic drift messages
        if score > thresholds["semantic_score"]:
            drift.append(f"🔤 Significant semantic shift detected (score: {score:.2%})")
        elif score > 0.2:
            drift.append(f"🔡 Moderate semantic change (score: {score:.2%})")
        
        # Vocabulary drift messages
        if vocab_drift > thresholds["vocabulary"]:
            drift.append(
                f"📚 Vocabulary drift: {vocab_drift:.2%} "
                f"({vocab_analysis.get('new_words_count', 0)} new words, "
                f"{vocab_analysis.get('removed_words_count', 0)} removed)"
            )
            
            # Add sample of new words
            new_words = vocab_analysis.get("new_words_sample", [])[:5]
            if new_words:
                drift.append(f"  ├─ New terms: {', '.join(new_words)}")
        
        # Generate explanation summary
        if score > thresholds["summary_threshold"]:
            try:
                explanation = generate_drift_summary(old_text, new_text)
            except Exception as e:
                logger.warning(f"Could not generate semantic summary: {e}")
                explanation = None
        
    except Exception as e:
        logger.error(f"Error in semantic drift detection: {e}")
    
    return drift, explanation, score


def calculate_overall_drift_severity(
    schema_drift: List[str],
    statistical_drift: List[str],
    semantic_drift: List[str],
    semantic_score: float
) -> Tuple[str, float]:
    """
    Calculate overall drift severity from all drift types.
    
    Args:
        schema_drift: Schema drift messages
        statistical_drift: Statistical drift messages
        semantic_drift: Semantic drift messages
        semantic_score: Semantic drift score
        
    Returns:
        Tuple of (severity_level, composite_score)
    """
    try:
        # Weight different drift types
        weights = {
            "schema": 0.4,      # Schema changes are serious
            "statistical": 0.3,  # Statistical changes important
            "semantic": 0.3      # Semantic changes matter for text
        }
        
        # Calculate component scores
        schema_score = min(len(schema_drift) / 5.0, 1.0)  # Normalize by 5 changes
        stat_score = min(len(statistical_drift) / 10.0, 1.0)  # Normalize by 10 changes
        
        # Composite score
        composite = (
            weights["schema"] * schema_score +
            weights["statistical"] * stat_score +
            weights["semantic"] * semantic_score
        )
        
        # Determine severity
        if composite >= 0.6:
            severity = "high"
        elif composite >= 0.3:
            severity = "medium"
        else:
            severity = "low"
        
        return severity, float(composite)
        
    except Exception as e:
        logger.error(f"Error calculating drift severity: {e}")
        return "unknown", 0.0


def generate_drift_report(
    schema_drift: List[str],
    statistical_drift: List[str],
    semantic_drift: List[str],
    semantic_explanation: Optional[str],
    semantic_score: float
) -> Dict[str, Any]:
    """
    Generate a comprehensive drift report.
    
    Returns:
        Dictionary with organized drift information
    """
    severity, composite_score = calculate_overall_drift_severity(
        schema_drift, statistical_drift, semantic_drift, semantic_score
    )
    
    return {
        "overall_severity": severity,
        "composite_score": composite_score,
        "drift_breakdown": {
            "schema": {
                "count": len(schema_drift),
                "messages": schema_drift
            },
            "statistical": {
                "count": len(statistical_drift),
                "messages": statistical_drift
            },
            "semantic": {
                "count": len(semantic_drift),
                "messages": semantic_drift,
                "score": semantic_score,
                "explanation": semantic_explanation
            }
        },
        "total_drift_issues": len(schema_drift) + len(statistical_drift) + len(semantic_drift),
        "recommendations": generate_recommendations(severity, composite_score)
    }


def generate_recommendations(severity: str, score: float) -> List[str]:
    """Generate actionable recommendations based on drift severity."""
    recommendations = []
    
    if severity == "high":
        recommendations.extend([
            "🚨 Immediate action required",
            "Review data pipeline for breaking changes",
            "Consider retraining models with recent data",
            "Alert stakeholders about data quality issues",
            "Implement emergency monitoring"
        ])
    elif severity == "medium":
        recommendations.extend([
            "⚠️ Monitor closely",
            "Investigate root causes of drift",
            "Schedule model retraining within 1-2 weeks",
            "Increase monitoring frequency",
            "Review data collection process"
        ])
    else:
        recommendations.extend([
            "✅ Continue normal monitoring",
            "Document current patterns for reference",
            "Schedule next review in 2-4 weeks"
        ])
    
    return recommendations