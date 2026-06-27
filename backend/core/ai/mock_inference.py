import json
import uuid

# Realistic mock findings for 3 demo case types
MOCK_FINDINGS = {
    "routine": {
        "density_category":       "B",
        "density_confidence":     0.91,
        "asymmetry_detected":     False,
        "lymph_node_abnormal":    False,
        "skin_changes_detected":  False,
        "edema_detected":         False,
        "findings":               []
    },

    "concerning": {
        "density_category":       "C",
        "density_confidence":     0.88,
        "asymmetry_detected":     False,
        "lymph_node_abnormal":    False,
        "skin_changes_detected":  False,
        "edema_detected":         False,
        "findings": [
            {
                "finding_type":             "Mass",
                "breast_side":              "L",
                "clock_position":           12,
                "quadrant":                 "UOQ",
                "distance_from_nipple_mm":  40.0,
                "size_length_mm":           8.5,
                "size_width_mm":            7.2,
                "size_area_mm2":            61.2,
                "margin_type":              "Spiculated",
                "density_level":            "High",
                "shape":                    "Irregular",
                "malignancy_probability":   0.78,
                "confidence_score":         0.88,
                "bi_rads_suggestion":       4,
                "recommended_action":       "Biopsy",
                "model_1_confidence":       0.88,
                "model_2_confidence":       0.85,
                "model_3_confidence":       0.82,
                "ensemble_agreement":       "3/3",
                "key_features_json":        json.dumps([
                    "Spiculated margins",
                    "High density",
                    "Irregular shape"
                ]),
                "feature_importance_json":  json.dumps([0.85, 0.78, 0.72])
            }
        ]
    },

    "urgent": {
        "density_category":       "D",
        "density_confidence":     0.94,
        "asymmetry_detected":     True,
        "lymph_node_abnormal":    True,
        "skin_changes_detected":  False,
        "edema_detected":         False,
        "findings": [
            {
                "finding_type":             "Mass",
                "breast_side":              "R",
                "clock_position":           10,
                "quadrant":                 "UOQ",
                "distance_from_nipple_mm":  35.0,
                "size_length_mm":           15.2,
                "size_width_mm":            12.8,
                "size_area_mm2":            194.6,
                "margin_type":              "Spiculated",
                "density_level":            "High",
                "shape":                    "Irregular",
                "malignancy_probability":   0.96,
                "confidence_score":         0.94,
                "bi_rads_suggestion":       5,
                "recommended_action":       "Urgent Biopsy",
                "model_1_confidence":       0.96,
                "model_2_confidence":       0.93,
                "model_3_confidence":       0.94,
                "ensemble_agreement":       "3/3",
                "key_features_json":        json.dumps([
                    "Spiculated margins",
                    "High density",
                    "Irregular shape",
                    "Large size > 10mm",
                    "Abnormal lymph node"
                ]),
                "feature_importance_json":  json.dumps([0.90, 0.85, 0.80, 0.75, 0.70])
            },
            {
                "finding_type":             "Calcification",
                "breast_side":              "R",
                "clock_position":           2,
                "quadrant":                 "UIQ",
                "distance_from_nipple_mm":  25.0,
                "size_length_mm":           3.2,
                "size_width_mm":            2.8,
                "size_area_mm2":            8.96,
                "margin_type":              "Ill-defined",
                "density_level":            "High",
                "shape":                    "Irregular",
                "malignancy_probability":   0.72,
                "confidence_score":         0.87,
                "bi_rads_suggestion":       4,
                "recommended_action":       "Biopsy",
                "model_1_confidence":       0.87,
                "model_2_confidence":       0.84,
                "model_3_confidence":       0.79,
                "ensemble_agreement":       "3/3",
                "key_features_json":        json.dumps([
                    "Clustered calcifications",
                    "Irregular morphology",
                    "High density"
                ]),
                "feature_importance_json":  json.dumps([0.88, 0.76, 0.65])
            }
        ]
    }
}

def run_inference(case_type: str = "concerning") -> dict:
    """
    Returns realistic mock AI findings for a given case type.
    case_type: 'routine' | 'concerning' | 'urgent'
    Replace this with real model inference in production.
    """
    result = MOCK_FINDINGS.get(case_type, MOCK_FINDINGS["concerning"])

    findings_with_ids = []
    for f in result["findings"]:
        finding = f.copy()
        finding["id"] = str(uuid.uuid4())
        findings_with_ids.append(finding)

    return {**result, "findings": findings_with_ids}
