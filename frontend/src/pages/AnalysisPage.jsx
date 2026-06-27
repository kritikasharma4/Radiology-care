import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCaseDetail } from '../services/api';
import FindingCard from '../components/FindingCard';
import RiskProfile from '../components/RiskProfile';

const URGENCY_BANNER = {
  urgent:     'bg-red-600 text-white',
  concerning: 'bg-yellow-500 text-white',
  routine:    'bg-green-600 text-white',
};

const URGENCY_ICON = {
  urgent:     '🔴',
  concerning: '🟡',
  routine:    '🟢',
};

const DENSITY_LABEL = { A: 'Almost Entirely Fatty', B: 'Scattered Fibroglandular', C: 'Heterogeneously Dense', D: 'Extremely Dense' };

export default function AnalysisPage() {
  const { caseId } = useParams();
  const navigate   = useNavigate();
  const [caseData, setCaseData]   = useState(null);
  const [findings, setFindings]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [feedbackMap, setFeedbackMap] = useState({});

  useEffect(() => {
    getCaseDetail(caseId)
      .then((r) => {
        setCaseData(r.data.case);
        setFindings(r.data.findings || []);
      })
      .catch(() => setError('Could not load case. Check backend is running.'))
      .finally(() => setLoading(false));
  }, [caseId]);

  const handleFeedback = (findingId, action) => {
    setFeedbackMap((m) => ({ ...m, [findingId]: action }));
  };

  if (loading) return <p className="p-8 text-gray-500">Loading analysis…</p>;
  if (error)   return <p className="p-8 text-red-500">{error}</p>;
  if (!caseData) return null;

  const urgency = caseData.overall_case_urgency || 'routine';
  const maxBirads = findings.length
    ? Math.max(...findings.map((f) => f.bi_rads_suggestion || 0))
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Urgency Banner */}
      <div className={`px-6 py-2 text-sm font-semibold flex items-center gap-2 ${URGENCY_BANNER[urgency]}`}>
        <span>{URGENCY_ICON[urgency]}</span>
        Case Urgency: {urgency.toUpperCase()}
        {maxBirads && <span className="ml-4 font-normal opacity-90">Highest BI-RADS: {maxBirads}</span>}
        <button
          onClick={() => navigate('/')}
          className="ml-auto font-normal opacity-80 hover:opacity-100 underline"
        >
          ← Back to Worklist
        </button>
      </div>

      <div className="flex h-[calc(100vh-88px)]">
        {/* LEFT: Image panel */}
        <div className="flex-1 bg-black flex flex-col items-center justify-center p-4 min-w-0">
          {caseData.preprocessed_image_path ? (
            <img
              src={`http://localhost:8000/${caseData.preprocessed_image_path}`}
              alt="Mammogram"
              className="max-h-full max-w-full object-contain rounded"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="text-gray-600 text-center">
              <p className="text-5xl mb-3">🩻</p>
              <p className="text-sm">Preprocessed image not available</p>
              <p className="text-xs text-gray-500 mt-1">{caseData.dicom_file_path || 'No file path'}</p>
            </div>
          )}
          {/* Image overlay stats */}
          <div className="mt-3 flex gap-3 text-xs text-gray-400">
            {caseData.quality_score != null && (
              <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-200">
                Quality: {Math.round(caseData.quality_score)}%
              </span>
            )}
            {caseData.density_category && (
              <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-200">
                Density: {caseData.density_category} — {DENSITY_LABEL[caseData.density_category] || ''}
              </span>
            )}
          </div>
        </div>

        {/* RIGHT: Analysis panel */}
        <div className="w-96 bg-gray-50 border-l border-gray-200 overflow-y-auto flex-shrink-0">
          <div className="p-4 space-y-4">
            {/* Patient Info */}
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="font-semibold text-gray-700 mb-2 text-sm uppercase tracking-wide">Patient</h3>
              <p className="font-bold text-gray-800">{caseData.patient_name || 'Anonymous'}</p>
              <p className="text-sm text-gray-500">ID: {caseData.patient_id}</p>
              <p className="text-sm text-gray-500">{caseData.age}y / {caseData.sex} — {caseData.study_date || 'No date'}</p>

              {/* Quality flags */}
              <div className="mt-2 flex flex-wrap gap-1">
                {caseData.motion_blur_detected   && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Motion blur</span>}
                {caseData.over_exposure_detected  && <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">Over-exposed</span>}
                {caseData.under_exposure_detected && <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">Under-exposed</span>}
                {caseData.image_clipping_detected && <span className="text-xs bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded">Clipping</span>}
                {caseData.wrong_positioning_detected && <span className="text-xs bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded">Positioning</span>}
                {!caseData.motion_blur_detected && !caseData.over_exposure_detected && !caseData.under_exposure_detected && (
                  <span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded">Good quality</span>
                )}
              </div>
            </div>

            {/* Risk Profile */}
            <RiskProfile caseData={caseData} />

            {/* Findings */}
            <div>
              <h3 className="font-semibold text-gray-700 mb-2 text-sm uppercase tracking-wide">
                AI Findings ({findings.length})
              </h3>
              {findings.length === 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center text-green-700 text-sm">
                  No significant findings detected
                </div>
              ) : (
                findings.map((f) => (
                  <FindingCard
                    key={f.id}
                    finding={f}
                    caseId={caseId}
                    onFeedbackSubmit={handleFeedback}
                  />
                ))
              )}
            </div>

            {/* Additional Breast Assessment */}
            {(caseData.asymmetry_detected || caseData.lymph_node_abnormal || caseData.skin_changes_detected || caseData.edema_detected) && (
              <div className="bg-white rounded-xl shadow p-4">
                <h3 className="font-semibold text-gray-700 mb-2 text-sm uppercase tracking-wide">Additional Findings</h3>
                <ul className="text-sm space-y-1 text-gray-700">
                  {caseData.asymmetry_detected    && <li>⚠ Asymmetry detected</li>}
                  {caseData.lymph_node_abnormal   && <li>⚠ Abnormal lymph nodes</li>}
                  {caseData.skin_changes_detected && <li>⚠ Skin changes</li>}
                  {caseData.edema_detected        && <li>⚠ Edema</li>}
                </ul>
              </div>
            )}

            {/* Feedback summary */}
            {Object.keys(feedbackMap).length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
                <p className="font-semibold mb-1">Feedback Recorded</p>
                {Object.entries(feedbackMap).map(([id, action]) => (
                  <p key={id} className="text-xs">Finding {id.slice(-6)}: {action}</p>
                ))}
                <p className="text-xs mt-1 text-blue-500">Stored for model retraining</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
