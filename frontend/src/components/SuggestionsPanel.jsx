import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const MANAGEMENT = {
  routine_screening:       { label: 'Routine Annual Screening',             color: 'text-green-700',  bg: 'bg-green-50  border-green-200',  dot: 'bg-green-500'  },
  short_interval_followup: { label: '6-Month Follow-up Mammogram',          color: 'text-amber-700',  bg: 'bg-amber-50  border-amber-200',  dot: 'bg-amber-500'  },
  additional_imaging:      { label: 'Additional Imaging Required',           color: 'text-amber-700',  bg: 'bg-amber-50  border-amber-200',  dot: 'bg-amber-500'  },
  tissue_sampling:         { label: 'Tissue Sampling — Biopsy Indicated',   color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500' },
  urgent_tissue_sampling:  { label: 'URGENT — Biopsy + Surgical Referral',  color: 'text-red-700',    bg: 'bg-red-50    border-red-200',    dot: 'bg-red-600'    },
};

const BIRADS_INFO = {
  0: { label: 'Incomplete',        sub: 'Additional imaging required.',                  color: 'bg-gray-500'   },
  1: { label: 'Negative',          sub: 'No findings. Continue annual screening.',       color: 'bg-green-500'  },
  2: { label: 'Benign',            sub: 'Definitely benign. Annual screening.',          color: 'bg-green-600'  },
  3: { label: 'Probably Benign',   sub: '<2% malignancy risk. 6-month follow-up.',       color: 'bg-yellow-500' },
  4: { label: 'Suspicious',        sub: '2–95% malignancy risk. Biopsy required.',       color: 'bg-orange-500' },
  5: { label: 'Highly Suspicious', sub: '≥95% malignancy probability. Urgent biopsy.',  color: 'bg-red-600'    },
  6: { label: 'Known Malignancy',  sub: 'Biopsy-proven. Coordinate with oncology.',     color: 'bg-red-900'    },
};

const FOLLOWUP = {
  routine_screening:       'Next mammogram in 12 months (standard annual schedule).',
  short_interval_followup: 'Return for follow-up mammogram in 6 months to assess stability.',
  additional_imaging:      'Proceed to diagnostic workup within 1–2 weeks.',
  tissue_sampling:         'Schedule biopsy within 2 weeks. Follow-up imaging after pathology result.',
  urgent_tissue_sampling:  'Contact patient today. Biopsy and surgical referral within 48 hours.',
};

const DENSITY_TEXT = {
  A: 'The breasts are almost entirely fatty (ACR Category A). Mammographic sensitivity is high.',
  B: 'There are scattered areas of fibroglandular density (ACR Category B).',
  C: 'The breasts are heterogeneously dense (ACR Category C), which may obscure small masses.',
  D: 'The breasts are extremely dense (ACR Category D), which significantly lowers mammographic sensitivity.',
};

const RISK_COLOR = {
  low: 'text-green-700', intermediate: 'text-amber-700', high: 'text-red-700',
};

function SubHeader({ children }) {
  return (
    <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-2 mt-4 first:mt-0">
      {children}
    </p>
  );
}

// ── Case Assessment edit panel ────────────────────────────────────────────────

const MGMT_OPTIONS = [
  { value: 'routine_screening',       label: 'Routine Annual Screening'           },
  { value: 'short_interval_followup', label: '6-Month Follow-up Mammogram'        },
  { value: 'additional_imaging',      label: 'Additional Imaging Required'        },
  { value: 'tissue_sampling',         label: 'Tissue Sampling — Biopsy Indicated' },
  { value: 'urgent_tissue_sampling',  label: 'URGENT — Biopsy + Surgical Referral'},
];

const DENSITY_OPTIONS = [
  { value: 'A', label: 'A — Almost entirely fatty'           },
  { value: 'B', label: 'B — Scattered fibroglandular density' },
  { value: 'C', label: 'C — Heterogeneously dense'           },
  { value: 'D', label: 'D — Extremely dense'                 },
];

function AssessmentEditPanel({ caseData, onSave, onCancel }) {
  const [form,  setForm]  = useState({
    overall_birads:        caseData.overall_birads ?? '',
    overall_impression:    caseData.overall_impression || '',
    recommended_management: caseData.recommended_management || '',
    density_category:      caseData.density_category || '',
  });
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState(null);

  const setF = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        overall_birads:         form.overall_birads !== '' ? Number(form.overall_birads) : undefined,
        overall_impression:     form.overall_impression    || undefined,
        recommended_management: form.recommended_management || undefined,
        density_category:       form.density_category      || undefined,
      };
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
      await onSave(payload);
    } catch (e) {
      setSaveError(e.response?.data?.detail || e.message || 'Save failed');
      setSaving(false);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-3">
      <p className="text-[9px] font-bold uppercase tracking-widest text-blue-500">Edit AI Assessment</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Overall BI-RADS</p>
          <select
            value={form.overall_birads}
            onChange={setF('overall_birads')}
            className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">—</option>
            {[0,1,2,3,4,5,6].map(n => (
              <option key={n} value={n}>BI-RADS {n} — {['Incomplete','Negative','Benign','Probably Benign','Suspicious','Highly Suspicious','Known Malignancy'][n]}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Breast Density</p>
          <select
            value={form.density_category}
            onChange={setF('density_category')}
            className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">—</option>
            {DENSITY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Recommended Management</p>
        <select
          value={form.recommended_management}
          onChange={setF('recommended_management')}
          className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="">—</option>
          {MGMT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Overall Impression</p>
        <textarea
          value={form.overall_impression}
          onChange={setF('overall_impression')}
          rows={3}
          placeholder="Overall impression text…"
          className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
        />
      </div>

      {saveError && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 text-xs py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Assessment'}
        </button>
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function SuggestionsPanel({ caseData, findings, signedOff, caseId, onCaseAssessmentUpdate }) {
  const navigate = useNavigate();
  const [assessEdit, setAssessEdit] = useState(false);
  const [localCase, setLocalCase] = useState(caseData);

  if (caseData !== localCase && !assessEdit) setLocalCase(caseData);

  const handleAssessmentSave = async (payload) => {
    await onCaseAssessmentUpdate(payload);
    setLocalCase(prev => ({ ...prev, ...payload }));
    setAssessEdit(false);
  };

  const mgmt    = localCase.recommended_management;
  const birads  = localCase.overall_birads;
  const mgmtCfg = MANAGEMENT[mgmt] || MANAGEMENT.routine_screening;
  const birdCfg = BIRADS_INFO[birads];

  return (
    <div className="p-5 space-y-1">

      {/* ── CV Detection Layer badge ── */}
      {localCase.cv_model && localCase.cv_model !== 'none' && (
        <div className="bg-blue-950 rounded-xl border border-blue-800 p-3 mb-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-bold text-blue-300 tracking-widest uppercase">CV Detection Layer</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${localCase.cv_is_neural ? 'bg-green-700 text-green-100' : 'bg-blue-700 text-blue-100'}`}>
              {localCase.cv_is_neural ? 'Neural Network' : 'Statistical CV'}
            </span>
          </div>
          <p className="text-[10px] text-blue-200 font-medium truncate mb-1.5">{localCase.cv_model}</p>
          {localCase.cv_suspicion_score != null && (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex justify-between mb-0.5">
                  <span className="text-[9px] text-blue-400">Suspicion score</span>
                  <span className={`text-[10px] font-bold ${
                    localCase.cv_suspicion_score >= 0.65 ? 'text-red-400' :
                    localCase.cv_suspicion_score >= 0.35 ? 'text-amber-400' : 'text-green-400'
                  }`}>{Math.round(localCase.cv_suspicion_score * 100)}%</span>
                </div>
                <div className="h-1.5 bg-blue-900 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      localCase.cv_suspicion_score >= 0.65 ? 'bg-red-500' :
                      localCase.cv_suspicion_score >= 0.35 ? 'bg-amber-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.round(localCase.cv_suspicion_score * 100)}%` }}
                  />
                </div>
              </div>
              {localCase.cv_density_class && (
                <div className="text-center">
                  <div className="text-[9px] text-blue-400 mb-0.5">Density</div>
                  <div className="text-sm font-black text-white">ACR {localCase.cv_density_class}</div>
                </div>
              )}
            </div>
          )}
          <p className="text-[9px] text-blue-500 mt-1.5 italic">
            CV model runs before LLM — LLM synthesizes from these scores
          </p>
        </div>
      )}

      {/* ── AI Impression & BI-RADS ── */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-2">
          <SubHeader>AI Impression</SubHeader>
          {!signedOff && !assessEdit && (
            <button
              onClick={() => setAssessEdit(true)}
              className="text-[10px] font-semibold text-blue-500 hover:text-blue-700 flex items-center gap-1 transition"
            >
              ✎ Edit
            </button>
          )}
        </div>

        {assessEdit ? (
          <AssessmentEditPanel
            caseData={localCase}
            onSave={handleAssessmentSave}
            onCancel={() => setAssessEdit(false)}
          />
        ) : (
          <>
            {birdCfg && (
              <div className="flex items-center gap-2 mb-3">
                <span className={`${birdCfg.color} text-white text-sm font-bold px-3 py-1 rounded-full`}>
                  BI-RADS {birads}
                </span>
                <span className="text-sm font-semibold text-gray-700">{birdCfg.label}</span>
              </div>
            )}
            {localCase.overall_impression && (
              <p className="text-xs text-gray-700 leading-relaxed">{localCase.overall_impression}</p>
            )}
            {birdCfg && (
              <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">{birdCfg.sub}</p>
            )}
            {localCase.density_category && (
              <p className="text-xs text-gray-500 mt-1">
                Density: ACR {localCase.density_category} — {DENSITY_TEXT[localCase.density_category]}
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Recommended Action ── */}
      {mgmt && (
        <div className={`rounded-xl border p-4 mt-4 ${mgmtCfg.bg}`}>
          <SubHeader>Recommended Next Step</SubHeader>
          <div className="flex items-start gap-3">
            <span className={`w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0 ${mgmtCfg.dot}`} />
            <div>
              <p className={`font-bold text-sm ${mgmtCfg.color}`}>{mgmtCfg.label}</p>
              {findings.length > 0 && findings[0].recommended_action && (
                <p className="text-xs text-gray-500 mt-1">{findings[0].recommended_action}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Follow-up Timeline ── */}
      {mgmt && (
        <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 mt-4">
          <SubHeader>Follow-up Timeline</SubHeader>
          <p className="text-xs text-gray-700 leading-relaxed">{FOLLOWUP[mgmt] || '—'}</p>
        </div>
      )}

      {/* ── Risk Context ── */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 mt-4">
        <SubHeader>Risk Context</SubHeader>

        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400">5-year risk score</span>
            <span className={`font-semibold ${RISK_COLOR[localCase.patient_risk_category] || 'text-gray-700'}`}>
              {localCase.overall_risk_score != null
                ? `${(localCase.overall_risk_score * 100).toFixed(1)}%`
                : '—'}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400">Risk category</span>
            <span className={`font-semibold capitalize ${RISK_COLOR[localCase.patient_risk_category] || 'text-gray-700'}`}>
              {localCase.patient_risk_category || '—'}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400">Breast density</span>
            <span className="font-semibold text-gray-700">
              {localCase.density_category ? `ACR ${localCase.density_category}` : '—'}
            </span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
          {!!localCase.family_history            && <p className="text-xs text-amber-700">· Family history of breast cancer</p>}
          {localCase.brca_mutation === 'positive' && <p className="text-xs text-red-600">· BRCA mutation positive</p>}
          {!!localCase.personal_breast_cancer    && <p className="text-xs text-red-600">· Personal history of breast cancer</p>}
          {!!localCase.previous_biopsy           && <p className="text-xs text-amber-700">· Previous biopsy on record</p>}
          {!!localCase.hormone_therapy           && <p className="text-xs text-amber-700">· On hormone replacement therapy</p>}
          {!localCase.family_history && !localCase.personal_breast_cancer && (
            <p className="text-xs text-green-700">· No major risk factors identified</p>
          )}
        </div>
      </div>

      {/* ── Open Full Report ── */}
      <div className="pt-4 pb-2">
        <button
          onClick={() => navigate(`/cases/${caseId}/report`)}
          className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm px-4 py-3 rounded-xl transition"
        >
          Open Full Report ↗
        </button>
        <p className="text-[10px] text-gray-400 text-center mt-1.5">
          Structured report · Edit &amp; sign-off · AI assistant · PDF export
        </p>
      </div>

      {/* ── Disclaimer ── */}
      <p className="text-[10px] text-gray-400 leading-relaxed pt-2 pb-4">
        AI suggestions follow ACR BI-RADS 5th Edition guidelines.
        All outputs require radiologist review before any clinical action.
      </p>
    </div>
  );
}
