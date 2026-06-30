import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCaseDetail, signOffCase, updateCasePatient, saveReport, updateCaseAssessment, chatWithCase } from '../services/api';
import FindingCard from '../components/FindingCard';
import SliceViewer from '../components/SliceViewer';
import SuggestionsPanel from '../components/SuggestionsPanel';

// ── Look-up tables ────────────────────────────────────────────────────────────

const URGENCY_BADGE = {
  urgent:     'bg-red-100    text-red-700    border-red-300',
  concerning: 'bg-amber-100  text-amber-700  border-amber-300',
  routine:    'bg-green-100  text-green-700  border-green-300',
};
const URGENCY_DOT = {
  urgent: 'bg-red-500', concerning: 'bg-amber-500', routine: 'bg-green-500',
};

const BIRADS_PILL = {
  0: 'bg-gray-500',   1: 'bg-green-500',  2: 'bg-green-600',
  3: 'bg-yellow-500', 4: 'bg-orange-500', 5: 'bg-red-600',   6: 'bg-red-900',
};
const BIRADS_LABEL = {
  0: 'Incomplete', 1: 'Negative', 2: 'Benign', 3: 'Probably Benign',
  4: 'Suspicious', 5: 'Highly Suspicious', 6: 'Known Malignancy',
};

const DENSITY_DESC = {
  A: 'Almost Entirely Fatty',
  B: 'Scattered Fibroglandular',
  C: 'Heterogeneously Dense',
  D: 'Extremely Dense',
};

const SERIES_LABEL = {
  tomosynthesis: { label: 'DBT — Tomo 3D', color: 'text-violet-400' },
  transpara:     { label: 'Transpara AI',   color: 'text-blue-400'   },
  '2d':          { label: '2D FFDM',        color: 'text-gray-400'   },
};

// ── Shared primitives ─────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-3 mt-5 first:mt-0">
      {children}
    </p>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-start py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 flex-shrink-0 w-36 leading-snug">{label}</span>
      <span className="text-xs text-gray-800 font-medium text-right leading-snug">{value ?? '—'}</span>
    </div>
  );
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-gray-50 rounded-xl border border-gray-100 p-4 ${className}`}>
      {children}
    </div>
  );
}

function AlertBadge({ show, label, severity }) {
  if (!show) return null;
  const styles = {
    error:   'bg-red-50    text-red-700   border-red-200',
    warning: 'bg-amber-50  text-amber-700 border-amber-200',
    ok:      'bg-green-50  text-green-700 border-green-200',
  };
  const prefix = { error: '✕', warning: '!', ok: '✓' };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border font-medium ${styles[severity]}`}>
      <span className="font-bold">{prefix[severity]}</span>
      {label}
    </span>
  );
}

function ObsFlag({ children }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 text-amber-800 text-xs border border-amber-100">
      <span className="font-bold mt-px shrink-0">!</span>
      {children}
    </div>
  );
}

// ── Inline edit primitives (dark-light compatible) ────────────────────────────

function EditInput({ value, onChange, type = 'text', ...rest }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
      {...rest}
    />
  );
}

function EditSelect({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
    >
      {children}
    </select>
  );
}

function EditCheckRow({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer py-1.5 border-b border-gray-50 last:border-0">
      <input type="checkbox" checked={checked} onChange={onChange} className="w-3.5 h-3.5 accent-blue-600 flex-shrink-0" />
      {label}
    </label>
  );
}

// ── Patient Info tab ──────────────────────────────────────────────────────────

function PatientTab({ caseData, onUpdate }) {
  const [editMode,  setEditMode]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [form,      setForm]      = useState({});

  const startEdit = () => {
    setForm({
      patient_name:            caseData.patient_name || '',
      age:                     caseData.age || 50,
      sex:                     caseData.sex || 'F',
      study_date:              caseData.study_date || '',
      menopause_status:        caseData.menopause_status || 'unknown',
      brca_mutation:           caseData.brca_mutation || 'unknown',
      family_history:          !!caseData.family_history,
      personal_breast_cancer:  !!caseData.personal_breast_cancer,
      hormone_therapy:         !!caseData.hormone_therapy,
      breast_implants:         !!caseData.breast_implants,
      previous_surgery:        !!caseData.previous_surgery,
      previous_biopsy:         !!caseData.previous_biopsy,
      reported_lump:           !!caseData.reported_lump,
      reported_pain:           !!caseData.reported_pain,
      reported_nipple_discharge: !!caseData.reported_nipple_discharge,
      overall_case_urgency:    caseData.overall_case_urgency || 'routine',
    });
    setSaveError(null);
    setEditMode(true);
  };

  const setF = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await onUpdate(form);
      setEditMode(false);
    } catch (e) {
      setSaveError(e.response?.data?.detail || e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const risk = caseData.patient_risk_category;
  const riskStyles = {
    low:          'bg-green-100  text-green-700  border-green-300',
    intermediate: 'bg-amber-100  text-amber-700  border-amber-300',
    high:         'bg-red-100    text-red-700    border-red-300',
  };

  const qualityIssues = [
    { show: !!caseData.motion_blur_detected,       label: 'Motion blur',         sev: 'error'   },
    { show: !!caseData.over_exposure_detected,     label: 'Over-exposed',        sev: 'error'   },
    { show: !!caseData.under_exposure_detected,    label: 'Under-exposed',       sev: 'warning' },
    { show: !!caseData.image_clipping_detected,    label: 'Image clipping',      sev: 'warning' },
    { show: !!caseData.wrong_positioning_detected, label: 'Positioning issues',  sev: 'warning' },
    { show: !!caseData.labels_covering_tissue,     label: 'Labels on tissue',    sev: 'warning' },
    { show: !!caseData.missing_breast_tissue,      label: 'Missing tissue',      sev: 'warning' },
  ];
  const hasIssue = qualityIssues.some(q => q.show);

  const seriesMeta = SERIES_LABEL[caseData.series_type] || SERIES_LABEL['2d'];

  return (
    <div className="p-5">

      {/* Edit mode toggle */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Patient Details</p>
        {!editMode && (
          <button
            onClick={startEdit}
            className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 px-2 py-0.5 rounded border border-blue-200 hover:border-blue-400 transition"
          >
            Edit Details
          </button>
        )}
      </div>

      {/* ── READ-ONLY view ── */}
      {!editMode && (
        <>
          <Card>
            <InfoRow label="Full Name"    value={caseData.patient_name || 'Anonymous'} />
            <InfoRow label="Patient ID"   value={<span className="font-mono text-xs">{caseData.patient_id}</span>} />
            <InfoRow label="Age / Sex"    value={`${caseData.age}y / ${caseData.sex}`} />
            <InfoRow label="Study Date"   value={caseData.study_date || '—'} />
            <InfoRow label="Modality"
              value={<span className={seriesMeta.color + ' font-semibold'}>{seriesMeta.label}</span>}
            />
            {caseData.total_slices > 1 && (
              <InfoRow label="Total Slices" value={`${caseData.total_slices}`} />
            )}
          </Card>

          <SectionTitle>Clinical History</SectionTitle>
          <Card>
            <InfoRow label="Menopause Status"
              value={<span className="capitalize">{caseData.menopause_status || 'Unknown'}</span>}
            />
            <InfoRow label="BRCA Mutation"
              value={
                caseData.brca_mutation === 'positive'
                  ? <span className="text-red-600 font-semibold">Positive</span>
                  : <span className="capitalize">{caseData.brca_mutation || 'Unknown'}</span>
              }
            />
            <InfoRow label="Hormone Therapy"  value={!!caseData.hormone_therapy  ? <span className="text-amber-700 font-medium">Yes</span> : 'No'} />
            <InfoRow label="Breast Implants"  value={!!caseData.breast_implants  ? 'Yes' : 'No'} />
            <InfoRow label="Previous Surgery" value={!!caseData.previous_surgery ? 'Yes' : 'No'} />
            <InfoRow label="Previous Biopsy"  value={!!caseData.previous_biopsy  ? <span className="text-amber-700 font-medium">Yes</span> : 'No'} />
            <InfoRow label="Family History"
              value={!!caseData.family_history ? <span className="text-amber-700 font-medium">Yes — breast cancer</span> : 'No'}
            />
            <InfoRow label="Personal History"
              value={!!caseData.personal_breast_cancer ? <span className="text-red-600 font-semibold">Yes — breast cancer</span> : 'No'}
            />
          </Card>

          <SectionTitle>Reported Symptoms</SectionTitle>
          <Card>
            <InfoRow label="Lump"
              value={!!caseData.reported_lump ? <span className="text-amber-700 font-medium">Reported</span> : 'None reported'}
            />
            <InfoRow label="Pain"
              value={!!caseData.reported_pain ? <span className="text-amber-700 font-medium">Reported</span> : 'None reported'}
            />
            <InfoRow label="Nipple Discharge"
              value={!!caseData.reported_nipple_discharge ? <span className="text-amber-700 font-medium">Reported</span> : 'None reported'}
            />
          </Card>
        </>
      )}

      {/* ── EDIT view ── */}
      {editMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-4 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Full Name</p>
              <EditInput value={form.patient_name} onChange={setF('patient_name')} placeholder="Patient name" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Age</p>
              <EditInput type="number" value={form.age} onChange={setF('age')} min={18} max={100} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Sex</p>
              <EditSelect value={form.sex} onChange={setF('sex')}>
                <option value="F">Female</option>
                <option value="M">Male</option>
              </EditSelect>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Study Date</p>
              <EditInput type="date" value={form.study_date} onChange={setF('study_date')} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Menopause Status</p>
              <EditSelect value={form.menopause_status} onChange={setF('menopause_status')}>
                <option value="unknown">Unknown</option>
                <option value="pre">Pre-menopausal</option>
                <option value="peri">Peri-menopausal</option>
                <option value="post">Post-menopausal</option>
              </EditSelect>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1">BRCA Mutation</p>
              <EditSelect value={form.brca_mutation} onChange={setF('brca_mutation')}>
                <option value="unknown">Unknown</option>
                <option value="negative">Negative</option>
                <option value="positive">Positive</option>
              </EditSelect>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Urgency</p>
              <EditSelect value={form.overall_case_urgency} onChange={setF('overall_case_urgency')}>
                <option value="routine">Routine</option>
                <option value="concerning">Concerning</option>
                <option value="urgent">Urgent</option>
              </EditSelect>
            </div>
          </div>

          <div>
            <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Clinical History</p>
            <Card>
              <EditCheckRow label="Family history of breast cancer"   checked={form.family_history}        onChange={setF('family_history')} />
              <EditCheckRow label="Personal history of breast cancer" checked={form.personal_breast_cancer} onChange={setF('personal_breast_cancer')} />
              <EditCheckRow label="Hormone replacement therapy (HRT)" checked={form.hormone_therapy}       onChange={setF('hormone_therapy')} />
              <EditCheckRow label="Breast implants"                   checked={form.breast_implants}       onChange={setF('breast_implants')} />
              <EditCheckRow label="Previous breast surgery"           checked={form.previous_surgery}      onChange={setF('previous_surgery')} />
              <EditCheckRow label="Previous biopsy"                   checked={form.previous_biopsy}       onChange={setF('previous_biopsy')} />
            </Card>
          </div>

          <div>
            <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Reported Symptoms</p>
            <Card>
              <EditCheckRow label="Reported lump"           checked={form.reported_lump}             onChange={setF('reported_lump')} />
              <EditCheckRow label="Reported pain"           checked={form.reported_pain}             onChange={setF('reported_pain')} />
              <EditCheckRow label="Nipple discharge"        checked={form.reported_nipple_discharge} onChange={setF('reported_nipple_discharge')} />
            </Card>
          </div>

          {saveError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 text-xs py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              onClick={() => setEditMode(false)}
              className="text-xs px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Image Quality ── (always read-only) */}
      <SectionTitle>Image Quality Assessment</SectionTitle>
      <Card>
        {caseData.quality_score != null && (
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-500">Quality Score</span>
              <span className={`font-bold ${
                caseData.quality_score >= 80 ? 'text-green-600' :
                caseData.quality_score >= 60 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {Math.round(caseData.quality_score)}%
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  caseData.quality_score >= 80 ? 'bg-green-500' :
                  caseData.quality_score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${caseData.quality_score}%` }}
              />
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {qualityIssues.map((q, i) => (
            <AlertBadge key={i} show={q.show} label={q.label} severity={q.sev} />
          ))}
          {!hasIssue && (
            <AlertBadge show severity="ok" label="No quality issues detected" />
          )}
        </div>
      </Card>

      {/* ── Risk Profile ── */}
      <SectionTitle>Risk Profile</SectionTitle>
      <Card>
        <div className="flex items-center justify-between mb-3">
          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${riskStyles[risk] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
            {(risk || 'unknown').toUpperCase()} RISK
          </span>
          {caseData.overall_risk_score != null && (
            <span className="text-xs text-gray-500">
              5-yr est:{' '}
              <span className="font-semibold text-gray-700">
                {(caseData.overall_risk_score * 100).toFixed(1)}%
              </span>
            </span>
          )}
        </div>

        {(!!caseData.family_history || !!caseData.personal_breast_cancer || caseData.brca_mutation === 'positive' || !!caseData.previous_biopsy || !!caseData.hormone_therapy) ? (
          <div className="space-y-1 mt-1">
            {!!caseData.family_history          && <p className="text-xs text-amber-700">· Family history of breast cancer</p>}
            {!!caseData.personal_breast_cancer  && <p className="text-xs text-red-600">· Personal history of breast cancer</p>}
            {caseData.brca_mutation === 'positive' && <p className="text-xs text-red-600">· BRCA mutation carrier</p>}
            {!!caseData.previous_biopsy         && <p className="text-xs text-amber-700">· Previous biopsy on record</p>}
            {!!caseData.hormone_therapy         && <p className="text-xs text-amber-700">· Currently on HRT</p>}
          </div>
        ) : (
          <p className="text-xs text-green-700 mt-1">No elevated risk factors identified</p>
        )}
      </Card>

      <div className="h-8" />
    </div>
  );
}

// ── Inline AI chat for findings tab ──────────────────────────────────────────

function FindingsChat({ caseId }) {
  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const bottomRef = useRef(null);

  const send = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    const history = messages.map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    try {
      const res = await chatWithCase(caseId, msg, history);
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Could not get a response. Check the API connection.' }]);
    } finally {
      setLoading(false);
    }
  }, [caseId, input, loading, messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const QUICK = [
    'What does this BI-RADS category mean?',
    'Explain the most suspicious finding',
    'What are the next clinical steps?',
    'Should I be concerned about the calcifications?',
  ];

  return (
    <div className="mt-5 border border-blue-100 rounded-xl overflow-hidden bg-blue-50/40">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-blue-600 text-white text-xs font-bold tracking-wide hover:bg-blue-700 transition"
      >
        <div className="flex items-center gap-2">
          <span className="bg-white/20 px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest">AI</span>
          Ask AI About These Findings
        </div>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="p-3">
          {/* Quick prompts */}
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {QUICK.map((q, i) => (
                <button
                  key={i}
                  onClick={() => send(q)}
                  className="text-[10px] bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-full px-2.5 py-1 transition text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="space-y-2 max-h-64 overflow-y-auto mb-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none shadow-sm'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 rounded-xl rounded-bl-none px-3 py-2.5 shadow-sm">
                  <div className="flex gap-1">
                    {[0,150,300].map(d => (
                      <div key={d} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex gap-1.5">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Ask anything about the AI findings…"
              disabled={loading}
              className="flex-1 border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-40 transition"
            >
              Send
            </button>
          </div>
          {messages.length > 0 && (
            <button onClick={() => setMessages([])} className="text-[10px] text-gray-400 hover:text-gray-600 mt-1.5 transition">
              Clear chat
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── AI Findings tab ───────────────────────────────────────────────────────────

function FindingsTab({ caseData, findings, caseId, onReviewUpdate, onFindingUpdate, reviewMap, signedOff }) {
  const hasExtra = !!caseData.asymmetry_detected || !!caseData.lymph_node_abnormal ||
    !!caseData.skin_changes_detected || !!caseData.nipple_changes || !!caseData.edema_detected;

  return (
    <div className="p-5">

      {/* ── AI Study Summary ── */}
      <SectionTitle>AI Study Summary</SectionTitle>
      <Card>
        <InfoRow label="Breast Density"
          value={caseData.density_category
            ? `ACR ${caseData.density_category} — ${DENSITY_DESC[caseData.density_category] || ''}`
            : '—'}
        />
        <InfoRow label="Bilateral Symmetry"
          value={caseData.bilateral_symmetry != null
            ? (!!caseData.bilateral_symmetry ? 'Symmetric' : 'Asymmetric')
            : '—'}
        />
        {caseData.overall_impression && (
          <div className="mt-3 text-xs text-gray-700 leading-relaxed bg-white rounded-lg p-3 border border-gray-100">
            {caseData.overall_impression}
          </div>
        )}
      </Card>

      {/* ── Additional Observations ── */}
      {hasExtra && (
        <>
          <SectionTitle>Additional Observations</SectionTitle>
          <div className="space-y-2">
            {!!caseData.asymmetry_detected    && <ObsFlag>Global asymmetry detected</ObsFlag>}
            {!!caseData.lymph_node_abnormal   && <ObsFlag>Abnormal axillary lymph nodes</ObsFlag>}
            {!!caseData.skin_changes_detected && <ObsFlag>Skin thickening / retraction noted</ObsFlag>}
            {!!caseData.nipple_changes        && <ObsFlag>Nipple changes noted</ObsFlag>}
            {!!caseData.edema_detected        && <ObsFlag>Breast edema detected</ObsFlag>}
          </div>
        </>
      )}

      {/* ── Individual Findings ── */}
      <SectionTitle>Findings ({findings.length})</SectionTitle>

      {findings.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
            <span className="text-green-600 font-bold text-lg">✓</span>
          </div>
          <p className="text-sm font-medium text-green-700">No significant findings</p>
          <p className="text-xs text-gray-400 mt-1">AI analysis detected no actionable abnormalities</p>
        </div>
      ) : (
        <div className="space-y-3">
          {findings.map(f => (
            <FindingCard
              key={f.id}
              finding={{ ...f, review_status: reviewMap[f.id] || f.review_status || 'pending' }}
              caseId={caseId}
              onReviewUpdate={onReviewUpdate}
              onFindingUpdate={onFindingUpdate}
              disabled={signedOff}
            />
          ))}
        </div>
      )}

      {/* ── Review Summary ── */}
      {Object.keys(reviewMap).length > 0 && (
        <>
          <SectionTitle>Review Summary</SectionTitle>
          <Card>
            <div className="space-y-1.5">
              {Object.entries(reviewMap).map(([id, st]) => {
                const styles = { accepted: 'text-green-700', modified: 'text-blue-700', rejected: 'text-red-600' };
                return (
                  <div key={id} className="flex justify-between text-xs">
                    <span className="text-gray-400 font-mono">…{id.slice(-6)}</span>
                    <span className={`font-semibold capitalize ${styles[st] || 'text-gray-600'}`}>{st}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}

      {/* ── AI Assistant ── */}
      <FindingsChat caseId={caseId} />

      <div className="h-8" />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const { caseId } = useParams();
  const navigate   = useNavigate();

  const [caseData,    setCaseData]    = useState(null);
  const [findings,    setFindings]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [activeTab,     setActiveTab]     = useState('findings');
  const [feedbackMap,   setFeedbackMap]   = useState({});
  const [reviewMap,     setReviewMap]     = useState({});  // findingId → status
  const [signedOff,     setSignedOff]     = useState(false);
  const [signingOff,    setSigningOff]    = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (e.key === '?') { setShowShortcuts(s => !s); return; }
      if (e.key === 'Escape') { setShowShortcuts(false); return; }
      if (e.key === '1') setActiveTab('patient');
      if (e.key === '2') setActiveTab('findings');
      if (e.key === '3') setActiveTab('suggestions');
      if (e.key === 'r' || e.key === 'R') navigate(`/cases/${caseId}/report`);
      if (e.key === 'Backspace' || e.key === 'g') navigate('/');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [caseId, navigate]);

  useEffect(() => {
    getCaseDetail(caseId)
      .then((r) => {
        const c = r.data.case;
        const f = r.data.findings || [];
        setCaseData(c);
        setFindings(f);
        setSignedOff(!!c.signed_off);
        // Seed reviewMap from DB state
        const initial = {};
        f.forEach(fi => { if (fi.review_status && fi.review_status !== 'pending') initial[fi.id] = fi.review_status; });
        setReviewMap(initial);
      })
      .catch((err) =>
        setError(`Could not load case. ${err.response?.data?.detail || err.message || 'Check backend is running.'}`)
      )
      .finally(() => setLoading(false));
  }, [caseId]);

  const handleFeedback = (findingId, action) =>
    setFeedbackMap((m) => ({ ...m, [findingId]: action }));

  const handleReviewUpdate = (findingId, status) =>
    setReviewMap((m) => ({ ...m, [findingId]: status }));

  const handlePatientUpdate = async (data) => {
    const res = await updateCasePatient(caseId, data);
    setCaseData(res.data.case);
  };

  const handleSaveReport = async (text) => {
    await saveReport(caseId, text);
    setCaseData(prev => ({ ...prev, final_report_text: text }));
  };

  const handleFindingUpdate = (findingId, fields) => {
    setFindings(prev => prev.map(f => f.id === findingId ? { ...f, ...fields } : f));
  };

  const handleCaseAssessmentUpdate = async (data) => {
    const res = await updateCaseAssessment(caseId, data);
    setCaseData(res.data.case);
  };

  const handleSignOff = async () => {
    setSigningOff(true);
    try {
      await signOffCase(caseId);
      setSignedOff(true);
    } catch (e) {
      console.error('Sign off failed', e);
    } finally {
      setSigningOff(false);
    }
  };

  const reviewedCount = Object.keys(reviewMap).length;
  const allReviewed   = findings.length === 0 || reviewedCount >= findings.length;

  if (loading) return (
    <div className="h-full flex items-center justify-center gap-3 text-gray-400 bg-gray-900">
      <span className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm">Loading case…</span>
    </div>
  );

  if (error) return (
    <div className="h-full flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <p className="text-red-400 text-sm mb-3">{error}</p>
        <button onClick={() => navigate('/')} className="text-xs text-gray-400 hover:text-white underline">
          ← Back to Worklist
        </button>
      </div>
    </div>
  );

  if (!caseData) return null;

  const urgency = caseData.overall_case_urgency || 'routine';
  const birads  = caseData.overall_birads;
  const series  = SERIES_LABEL[caseData.series_type] || SERIES_LABEL['2d'];

  const tabs = [
    { id: 'patient',     label: 'Patient Info'  },
    { id: 'findings',    label: 'AI Findings',  count: findings.length },
    { id: 'suggestions', label: 'Suggestions'   },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-900 overflow-hidden">

      {/* ── Banners ──────────────────────────────────────────────────── */}
      {!!caseData.is_mock && caseData.mock_reason && (
        <div className="bg-red-950 border-b border-red-800 px-5 py-2.5 text-xs text-red-300 flex-shrink-0 flex items-start gap-2">
          <span className="text-red-400 font-bold text-sm leading-none mt-px">⚠</span>
          <div>
            <strong className="text-red-200">AI analysis unavailable for this case</strong>
            {' — '}the AI provider could not process these images (content moderation block).
            Findings shown below are <strong>placeholder data only</strong> and must not be used for clinical decisions.
            Contact support or re-analyse with a different AI provider.
          </div>
        </div>
      )}
      {!!caseData.is_mock && !caseData.mock_reason && (
        <div className="bg-amber-950 border-b border-amber-800 px-5 py-2 text-xs text-amber-300 flex-shrink-0">
          <strong>Demo mode</strong> — findings are illustrative mock data.
          {' '}Set your API key in{' '}
          <code className="bg-amber-900/50 px-1 rounded">backend/.env</code> for live AI analysis.
        </div>
      )}
      <div className="bg-blue-950/60 border-b border-blue-900 px-5 py-1.5 text-xs text-blue-300/80 flex-shrink-0">
        AI outputs are for decision support only — radiologist review mandatory before clinical action.
      </div>

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="bg-gray-800 border-b border-gray-700 px-5 py-3 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-1.5"
        >
          ← Worklist
        </button>
        <span className="h-4 w-px bg-gray-600" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-white font-semibold text-sm">
              {caseData.patient_name || 'Anonymous'}
            </span>
            <span className="text-gray-500 text-xs font-mono">{caseData.patient_id}</span>

            {/* Urgency badge */}
            <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${URGENCY_BADGE[urgency] || URGENCY_BADGE.routine}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${URGENCY_DOT[urgency] || URGENCY_DOT.routine}`} />
              {urgency.toUpperCase()}
            </span>

            {/* BI-RADS pill */}
            {birads != null && (
              <span className={`text-white text-xs font-bold px-2.5 py-0.5 rounded-full ${BIRADS_PILL[birads]}`}>
                BI-RADS {birads} · {BIRADS_LABEL[birads] || ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
            <span>{caseData.age}y / {caseData.sex}</span>
            {caseData.study_date && <><span>·</span><span>{caseData.study_date}</span></>}
            <span>·</span>
            <span className={series.color + ' font-medium'}>{series.label}</span>
            {caseData.total_slices > 1 && <span>({caseData.total_slices} slices)</span>}
          </div>
        </div>

        {/* AI provider chip */}
        {!!caseData.is_mock ? (
          <span className="text-xs px-2.5 py-1 rounded-full border bg-amber-900/30 text-amber-400 border-amber-700 flex-shrink-0">
            Mock AI
          </span>
        ) : (
          <span className="text-xs px-2.5 py-1 rounded-full border bg-green-900/30 text-green-400 border-green-700 flex-shrink-0">
            {caseData.ai_provider}
          </span>
        )}

        {/* Full Report button */}
        <button
          onClick={() => navigate(`/cases/${caseId}/report`)}
          className="flex-shrink-0 ml-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 transition"
          title="Open full-page report view (R)"
        >
          Full Report ↗
        </button>

        {/* Shortcuts help */}
        <button
          onClick={() => setShowShortcuts(true)}
          className="flex-shrink-0 text-xs text-gray-500 hover:text-gray-300 border border-gray-700 rounded px-2 py-1 transition"
          title="Keyboard shortcuts"
        >
          ?
        </button>

        {/* Sign Off button */}
        <div className="flex-shrink-0 ml-2">
          {signedOff ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-600 text-white">
              <span className="text-sm">✓</span> Signed Off
            </span>
          ) : (
            <button
              onClick={handleSignOff}
              disabled={signingOff}
              title={!allReviewed ? `Review all findings first (${reviewedCount}/${findings.length} done)` : 'Sign off this case'}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                allReviewed
                  ? 'bg-blue-600 text-white hover:bg-blue-500'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              } disabled:opacity-60`}
            >
              {signingOff
                ? 'Signing…'
                : findings.length > 0
                  ? `Sign Off (${reviewedCount}/${findings.length})`
                  : 'Sign Off'}
            </button>
          )}
        </div>
      </div>

      {/* ── Content area ─────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Image viewer */}
        <SliceViewer
          caseId={caseId}
          caseData={caseData}
          seriesType={caseData.series_type || '2d'}
          findings={findings}
        />

        {/* Right panel ─ tabbed */}
        <div className="w-[440px] flex flex-col bg-white border-l border-gray-700 flex-shrink-0">

          {/* Tab strip */}
          <div className="flex border-b border-gray-200 bg-gray-50 flex-shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 text-xs font-semibold tracking-wide transition-all ${
                  activeTab === tab.id
                    ? 'text-blue-600 bg-white border-b-2 border-blue-600 -mb-px'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
                {tab.count != null && (
                  <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab body — scrollable */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'patient'     && <PatientTab caseData={caseData} onUpdate={handlePatientUpdate} />}
            {activeTab === 'findings'    && (
              <FindingsTab
                caseData={caseData}
                findings={findings}
                caseId={caseId}
                onReviewUpdate={handleReviewUpdate}
                onFindingUpdate={handleFindingUpdate}
                reviewMap={reviewMap}
                signedOff={signedOff}
              />
            )}
            {activeTab === 'suggestions' && (
              <SuggestionsPanel
                caseData={caseData}
                findings={findings}
                signedOff={signedOff}
                caseId={caseId}
                onSaveReport={handleSaveReport}
                onCaseAssessmentUpdate={handleCaseAssessmentUpdate}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Keyboard shortcuts overlay ────────────────────────────────── */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowShortcuts(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-white">Keyboard Shortcuts</p>
              <button onClick={() => setShowShortcuts(false)} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
            </div>
            <div className="space-y-2">
              {[
                ['1', 'Patient Info tab'],
                ['2', 'Findings tab'],
                ['3', 'Suggestions tab'],
                ['R', 'Open Full Report'],
                ['G', 'Go to Worklist'],
                ['?', 'Toggle this help'],
                ['Esc', 'Close overlay'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{desc}</span>
                  <kbd className="text-xs font-mono bg-gray-800 border border-gray-600 text-gray-200 px-2 py-0.5 rounded">{key}</kbd>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 mt-4">Shortcuts disabled when typing in input fields</p>
          </div>
        </div>
      )}
    </div>
  );
}
