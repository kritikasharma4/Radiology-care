import { useState } from 'react';
import { submitFeedback } from '../services/api';

const BIRADS_COLOR = {
  1: 'bg-green-100 text-green-700',
  2: 'bg-green-100 text-green-700',
  3: 'bg-yellow-100 text-yellow-700',
  4: 'bg-orange-100 text-orange-700',
  5: 'bg-red-100 text-red-700',
  6: 'bg-red-200 text-red-800',
};

const MARGIN_COLOR = {
  Spiculated:       'text-red-600 font-semibold',
  'Micro-lobulated': 'text-orange-600',
  'Ill-defined':     'text-yellow-600',
  'Well-defined':    'text-green-600',
};

export default function FindingCard({ finding, caseId, onFeedbackSubmit }) {
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [submitted, setSubmitted]     = useState(null);
  const [submitting, setSubmitting]   = useState(false);

  const sendFeedback = async (action) => {
    setSubmitting(true);
    try {
      await submitFeedback({
        case_id:            caseId,
        finding_id:         finding.id,
        radiologist_action: action,
        radiologist_id:     'demo_radiologist',
        use_for_retraining: 1,
      });
      setSubmitted(action);
      if (onFeedbackSubmit) onFeedbackSubmit(finding.id, action);
    } catch (e) {
      console.error('Feedback failed', e);
    } finally {
      setSubmitting(false);
    }
  };

  let features = [];
  try { features = JSON.parse(finding.key_features_json || '[]'); } catch {}

  let importance = [];
  try { importance = JSON.parse(finding.feature_importance_json || '[]'); } catch {}

  const biradsNum  = finding.bi_rads_suggestion;
  const malignPct  = finding.malignancy_probability != null
    ? (finding.malignancy_probability * 100).toFixed(0)
    : null;
  const confPct    = finding.confidence_score != null
    ? (finding.confidence_score * 100).toFixed(0)
    : null;

  return (
    <div className="border border-gray-200 rounded-xl p-4 mb-3 bg-white shadow-sm">
      {/* Header row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="font-bold text-gray-800 text-base">{finding.finding_type}</span>
          {finding.breast_side && (
            <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {finding.breast_side === 'L' ? 'Left' : 'Right'} breast
            </span>
          )}
        </div>
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${BIRADS_COLOR[biradsNum] || 'bg-gray-100 text-gray-600'}`}>
          BI-RADS {biradsNum}
        </span>
      </div>

      {/* Confidence bar */}
      {confPct && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-0.5">
            <span>AI Confidence</span>
            <span>{confPct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full">
            <div
              className="h-1.5 bg-blue-500 rounded-full"
              style={{ width: `${confPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3">
        {finding.clock_position && (
          <p><span className="text-gray-500">Location:</span> {finding.clock_position} o'clock, {finding.quadrant}</p>
        )}
        {finding.distance_from_nipple_mm && (
          <p><span className="text-gray-500">Distance:</span> {finding.distance_from_nipple_mm} mm from nipple</p>
        )}
        {finding.size_length_mm && (
          <p><span className="text-gray-500">Size:</span> {finding.size_length_mm} × {finding.size_width_mm} mm</p>
        )}
        {finding.margin_type && (
          <p>
            <span className="text-gray-500">Margin:</span>{' '}
            <span className={MARGIN_COLOR[finding.margin_type] || ''}>
              {finding.margin_type}
            </span>
          </p>
        )}
        {finding.density_level && (
          <p><span className="text-gray-500">Density:</span> {finding.density_level}</p>
        )}
        {finding.shape && (
          <p><span className="text-gray-500">Shape:</span> {finding.shape}</p>
        )}
        {malignPct && (
          <p>
            <span className="text-gray-500">Malignancy prob:</span>{' '}
            <span className={parseInt(malignPct) >= 70 ? 'text-red-600 font-semibold' : 'text-gray-700'}>
              {malignPct}%
            </span>
          </p>
        )}
        {finding.recommended_action && (
          <p><span className="text-gray-500">Action:</span> {finding.recommended_action}</p>
        )}
      </div>

      {/* Ensemble voting */}
      {finding.ensemble_agreement && (
        <div className="bg-blue-50 rounded px-3 py-2 text-xs text-blue-700 mb-3">
          <span className="font-semibold">Ensemble consensus:</span> {finding.ensemble_agreement} models agree
          {finding.model_1_confidence && (
            <span className="ml-2 text-blue-500">
              ({(finding.model_1_confidence * 100).toFixed(0)}% / {(finding.model_2_confidence * 100).toFixed(0)}% / {(finding.model_3_confidence * 100).toFixed(0)}%)
            </span>
          )}
        </div>
      )}

      {/* Feature importance */}
      {features.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Key Features</p>
          {features.map((feat, i) => (
            <div key={i} className="flex items-center gap-2 mb-0.5">
              <span className="text-xs text-gray-600 w-36 truncate">{feat}</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
                <div
                  className="h-1.5 bg-orange-400 rounded-full"
                  style={{ width: `${(importance[i] || 0) * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">{((importance[i] || 0) * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Heatmap toggle */}
      {finding.heatmap_file_path && (
        <div className="mb-3">
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className="text-xs text-blue-600 hover:underline"
          >
            {showHeatmap ? 'Hide Heatmap ▲' : 'Show Heatmap ▼'}
          </button>
          {showHeatmap && (
            <div className="mt-2 bg-gray-100 rounded p-2 text-center text-xs text-gray-400">
              [Heatmap: {finding.heatmap_file_path}]
              <br />Grad-CAM overlay will appear here (Phase 5)
            </div>
          )}
        </div>
      )}

      {/* Feedback actions */}
      {submitted ? (
        <div className="text-xs text-green-600 font-medium">
          ✓ Feedback submitted: {submitted}
        </div>
      ) : (
        <div className="flex gap-2 mt-2">
          <button
            disabled={submitting}
            onClick={() => sendFeedback('confirmed')}
            className="text-xs px-3 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
          >
            Accept
          </button>
          <button
            disabled={submitting}
            onClick={() => sendFeedback('corrected')}
            className="text-xs px-3 py-1 rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200 disabled:opacity-50"
          >
            Modify
          </button>
          <button
            disabled={submitting}
            onClick={() => sendFeedback('dismissed')}
            className="text-xs px-3 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
