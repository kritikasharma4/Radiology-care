import { useState } from 'react';
import { reviewFinding, updateFinding } from '../services/api';

const STATUS_STYLE = {
  pending:  { label: 'Pending Review', bg: 'bg-gray-100  text-gray-500  border-gray-200'  },
  accepted: { label: 'Accepted',       bg: 'bg-green-100 text-green-700 border-green-300' },
  modified: { label: 'Modified',       bg: 'bg-blue-100  text-blue-700  border-blue-300'  },
  rejected: { label: 'Rejected',       bg: 'bg-red-100   text-red-600   border-red-300'   },
};

const BIRADS_CONFIG = {
  0: { color: 'bg-gray-500',    label: 'Incomplete',          text: 'text-gray-700'   },
  1: { color: 'bg-green-500',   label: 'Negative',            text: 'text-green-700'  },
  2: { color: 'bg-green-600',   label: 'Benign',              text: 'text-green-700'  },
  3: { color: 'bg-yellow-500',  label: 'Probably Benign',     text: 'text-yellow-700' },
  4: { color: 'bg-orange-500',  label: 'Suspicious',          text: 'text-orange-700' },
  5: { color: 'bg-red-600',     label: 'Highly Suspicious',   text: 'text-red-700'    },
  6: { color: 'bg-red-900',     label: 'Known Malignancy',    text: 'text-red-900'    },
};

const MARGIN_COLOR = {
  spiculated:     'text-red-600 font-semibold',
  microlobulated: 'text-orange-600',
  indistinct:     'text-yellow-700',
  circumscribed:  'text-green-600',
};

const FINDING_TYPES = [
  'mass','calcification','architectural_distortion','asymmetry',
  'skin_thickening','lymph_node','nipple_retraction','other',
];
const QUADRANTS   = ['upper_outer','upper_inner','lower_outer','lower_inner','central','axillary_tail'];
const DEPTHS      = ['anterior','middle','posterior'];
const SHAPES      = ['round','oval','lobular','irregular'];
const MARGINS     = ['circumscribed','obscured','microlobulated','indistinct','spiculated'];
const DENSITIES   = ['fat_containing','low','equal','high'];
const CALC_MORPHS = ['amorphous','coarse_heterogeneous','fine_pleomorphic','fine_linear','punctate'];
const CALC_DISTS  = ['diffuse','regional','grouped','linear','segmental'];

// ── Form helpers ──────────────────────────────────────────────────────────────

function FL({ children }) {
  return <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{children}</p>;
}
function FS({ value, onChange, children }) {
  return (
    <select value={value} onChange={onChange}
      className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
      {children}
    </select>
  );
}
function FI({ value, onChange, type = 'text', placeholder = '', ...rest }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
      {...rest} />
  );
}
function FT({ value, onChange, placeholder = '', rows = 2 }) {
  return (
    <textarea value={value} onChange={onChange} rows={rows} placeholder={placeholder}
      className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
  );
}
function SideBtn({ label, active, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex-1 py-1 text-xs font-semibold rounded-md border transition ${
        active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
      }`}>
      {label}
    </button>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SecHead({ children }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-widest text-blue-500 mb-2 mt-3 first:mt-0 flex items-center gap-1.5">
      <span className="flex-1 h-px bg-blue-100" />
      {children}
      <span className="flex-1 h-px bg-blue-100" />
    </p>
  );
}

// ── Row used inside structured sections ───────────────────────────────────────

function DataRow({ label, value, highlight }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-2 py-1 border-b border-gray-50 last:border-0">
      <span className="text-[11px] text-gray-400 w-36 flex-shrink-0 leading-snug">{label}</span>
      <span className={`text-[11px] font-medium leading-snug ${highlight || 'text-gray-800'}`}>{value}</span>
    </div>
  );
}

// ── Malignancy risk bar ───────────────────────────────────────────────────────

function MalignBar({ pct }) {
  const color = pct >= 70 ? 'bg-red-500' : pct >= 40 ? 'bg-orange-400' : pct >= 20 ? 'bg-yellow-400' : 'bg-green-400';
  const label = pct >= 70 ? 'High' : pct >= 40 ? 'Moderate-High' : pct >= 20 ? 'Moderate' : 'Low';
  const textColor = pct >= 70 ? 'text-red-600' : pct >= 40 ? 'text-orange-600' : pct >= 20 ? 'text-yellow-600' : 'text-green-600';
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] text-gray-400">Malignancy Probability</span>
        <span className={`text-xs font-bold ${textColor}`}>{pct}% — {label}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FindingCard({ finding, caseId, onReviewUpdate, onFindingUpdate, disabled }) {
  const [status,    setStatus]    = useState(finding.review_status || 'pending');
  const [editOpen,  setEditOpen]  = useState(false);
  const [expanded,  setExpanded]  = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [local,     setLocal]     = useState({ ...finding });

  const initForm = () => ({
    finding_type:               local.finding_type || '',
    breast_side:                local.breast_side || '',
    clock_position:             local.clock_position ?? '',
    quadrant:                   local.quadrant || '',
    distance_from_nipple_mm:    local.distance_from_nipple_mm ?? '',
    depth:                      local.depth || '',
    size_length_mm:             local.size_length_mm ?? '',
    size_width_mm:              local.size_width_mm ?? '',
    shape:                      local.shape || '',
    margin_type:                local.margin_type || '',
    density_level:              local.density_level || '',
    calcification_morphology:   local.calcification_morphology || '',
    calcification_distribution: local.calcification_distribution || '',
    bi_rads_suggestion:         local.bi_rads_suggestion ?? '',
    malignancy_probability:     local.malignancy_probability != null
                                  ? Math.round(local.malignancy_probability * 100) : '',
    recommended_action:         local.recommended_action || '',
    ai_reasoning:               local.ai_reasoning || '',
    reviewer_notes:             local.reviewer_notes || '',
  });

  const [form, setForm] = useState(initForm);
  const setF    = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));
  const setSide = (val) => setForm(f => ({ ...f, breast_side: val }));

  const openEdit = () => { setForm(initForm()); setSaveError(null); setEditOpen(true); };

  const quickAction = async (newStatus) => {
    if (newStatus === 'modified') { openEdit(); return; }
    setSaving(true); setSaveError(null);
    try {
      await reviewFinding(finding.id, { status: newStatus, reviewed_birads: null, reviewer_notes: null, reviewed_by: 'radiologist_1' });
      setStatus(newStatus);
      if (onReviewUpdate) onReviewUpdate(finding.id, newStatus);
    } catch (e) {
      setSaveError(e.response?.data?.detail || e.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleSave = async () => {
    setSaving(true); setSaveError(null);
    try {
      const toNum = (v) => (v === '' || v == null ? undefined : Number(v));
      const payload = {
        finding_type:               form.finding_type             || undefined,
        breast_side:                form.breast_side              || undefined,
        clock_position:             toNum(form.clock_position),
        quadrant:                   form.quadrant                 || undefined,
        distance_from_nipple_mm:    toNum(form.distance_from_nipple_mm),
        depth:                      form.depth                    || undefined,
        size_length_mm:             toNum(form.size_length_mm),
        size_width_mm:              toNum(form.size_width_mm),
        shape:                      form.shape                    || undefined,
        margin_type:                form.margin_type              || undefined,
        density_level:              form.density_level            || undefined,
        calcification_morphology:   form.calcification_morphology || undefined,
        calcification_distribution: form.calcification_distribution || undefined,
        bi_rads_suggestion:         toNum(form.bi_rads_suggestion),
        malignancy_probability:     form.malignancy_probability !== ''
                                      ? Number(form.malignancy_probability) / 100 : undefined,
        recommended_action:         form.recommended_action       || undefined,
        ai_reasoning:               form.ai_reasoning             || undefined,
        reviewer_notes:             form.reviewer_notes           || undefined,
        reviewed_by:                'radiologist_1',
      };
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
      await updateFinding(finding.id, payload);
      const newLocal = { ...local, ...payload };
      setLocal(newLocal);
      setStatus('modified');
      setEditOpen(false);
      if (onReviewUpdate)  onReviewUpdate(finding.id, 'modified');
      if (onFindingUpdate) onFindingUpdate(finding.id, payload);
    } catch (e) {
      setSaveError(e.response?.data?.detail || e.message || 'Save failed');
    } finally { setSaving(false); }
  };

  // ── Parse JSON fields ─────────────────────────────────────────────────────

  let features = [];
  let differentials = [];
  try { features      = JSON.parse(local.key_features_json         || '[]'); } catch {}
  try { differentials = JSON.parse(local.differential_diagnosis_json || '[]'); } catch {}

  const malignPct = local.malignancy_probability != null
    ? Math.round(local.malignancy_probability * 100) : null;
  const confPct   = local.confidence_score != null
    ? Math.round(local.confidence_score * 100) : null;

  const st      = STATUS_STYLE[status] || STATUS_STYLE.pending;
  const isDone  = status !== 'pending';
  const isCalc  = (form.finding_type || local.finding_type || '').includes('calc');
  const birads  = BIRADS_CONFIG[local.bi_rads_suggestion] || {};

  const sideLabel = local.breast_side === 'L' ? 'Left' : local.breast_side === 'R' ? 'Right' : local.breast_side === 'bilateral' ? 'Bilateral' : local.breast_side;

  return (
    <div className={`border rounded-xl bg-white shadow-sm overflow-hidden transition-all ${
      status === 'rejected'
        ? 'border-red-200 opacity-60'
        : status === 'accepted' || status === 'modified'
          ? 'border-green-300'
          : 'border-gray-200'
    }`}>

      {/* ── Header bar ── */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none bg-gray-50 border-b border-gray-100"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* BI-RADS pill */}
          {local.bi_rads_suggestion != null && (
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${birads.color || 'bg-gray-400'} flex items-center justify-center`}>
              <span className="text-white text-xs font-black">{local.bi_rads_suggestion}</span>
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900 text-sm capitalize">
                {(local.finding_type || 'Finding').replace(/_/g, ' ')}
              </span>
              {sideLabel && (
                <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full font-medium">
                  {sideLabel} breast
                </span>
              )}
              {local.bi_rads_suggestion != null && (
                <span className={`text-xs font-semibold ${birads.text || ''}`}>
                  BI-RADS {local.bi_rads_suggestion} — {birads.label}
                </span>
              )}
            </div>
            {local.clock_position && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                {local.clock_position} o'clock
                {local.quadrant ? ` · ${local.quadrant.replace(/_/g, ' ')}` : ''}
                {local.distance_from_nipple_mm ? ` · ${local.distance_from_nipple_mm} mm from nipple` : ''}
                {local.depth ? ` · ${local.depth}` : ''}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${st.bg}`}>
            {st.label}
          </span>
          <span className="text-gray-300 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* ── Expandable body ── */}
      {expanded && (
        <div className="px-4 pb-4 space-y-1">

          {/* 1. MALIGNANCY RISK */}
          {malignPct != null && (
            <div className="pt-3">
              <MalignBar pct={malignPct} />
            </div>
          )}

          {/* 2. LOCATION */}
          {(local.clock_position || local.quadrant || local.depth || local.distance_from_nipple_mm) && (
            <>
              <SecHead>Location</SecHead>
              <div className="bg-gray-50 rounded-lg px-3 py-1">
                <DataRow label="Breast side"           value={sideLabel} />
                <DataRow label="Clock position"        value={local.clock_position ? `${local.clock_position} o'clock` : null} />
                <DataRow label="Quadrant"              value={local.quadrant?.replace(/_/g, ' ')} />
                <DataRow label="Depth"                 value={local.depth} />
                <DataRow label="Distance from nipple"  value={local.distance_from_nipple_mm ? `${local.distance_from_nipple_mm} mm` : null} />
              </div>
            </>
          )}

          {/* 3. MORPHOLOGY */}
          {(local.size_length_mm || local.shape || local.margin_type || local.density_level ||
            local.calcification_morphology || local.calcification_distribution) && (
            <>
              <SecHead>Morphology</SecHead>
              <div className="bg-gray-50 rounded-lg px-3 py-1">
                {(local.size_length_mm || local.size_width_mm) && (
                  <DataRow label="Size"
                    value={`${local.size_length_mm || '?'} × ${local.size_width_mm || '?'} mm`} />
                )}
                <DataRow label="Shape" value={local.shape} />
                <DataRow
                  label="Margin"
                  value={local.margin_type}
                  highlight={MARGIN_COLOR[local.margin_type]}
                />
                <DataRow label="Density" value={local.density_level?.replace(/_/g, ' ')} />
                <DataRow label="Calcification morphology"    value={local.calcification_morphology?.replace(/_/g, ' ')} />
                <DataRow label="Calcification distribution"  value={local.calcification_distribution} />
              </div>
            </>
          )}

          {/* 4. KEY FEATURES */}
          {features.length > 0 && (
            <>
              <SecHead>Key Imaging Features</SecHead>
              <ul className="space-y-1 pl-1">
                {features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* 5. AI REASONING */}
          {local.ai_reasoning && (
            <>
              <SecHead>AI Clinical Reasoning</SecHead>
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
                <p className="text-xs text-blue-900 leading-relaxed">{local.ai_reasoning}</p>
              </div>
            </>
          )}

          {/* 6. DIFFERENTIAL DIAGNOSIS */}
          {differentials.length > 0 && (
            <>
              <SecHead>Differential Diagnosis</SecHead>
              <div className="rounded-lg overflow-hidden border border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Diagnosis</th>
                      <th className="text-center px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-20">Probability</th>
                      <th className="text-left px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Supporting Evidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {differentials.map((d, i) => {
                      const pct = Math.round((d.probability || 0) * 100);
                      const barColor = pct >= 60 ? 'bg-red-400' : pct >= 30 ? 'bg-orange-400' : 'bg-green-400';
                      return (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-semibold text-gray-800">{d.diagnosis}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-bold text-gray-700">{pct}%</span>
                              <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-gray-500 leading-snug">{d.evidence}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* 7. RECOMMENDED ACTION */}
          {local.recommended_action && (
            <>
              <SecHead>Recommended Action</SecHead>
              <div className={`rounded-lg px-3 py-2.5 border ${
                local.bi_rads_suggestion >= 5 ? 'bg-red-50 border-red-200 text-red-800' :
                local.bi_rads_suggestion >= 4 ? 'bg-orange-50 border-orange-200 text-orange-800' :
                local.bi_rads_suggestion >= 3 ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                'bg-green-50 border-green-200 text-green-800'
              }`}>
                <p className="text-xs font-medium leading-snug">{local.recommended_action}</p>
              </div>
            </>
          )}

          {/* 8. AI CONFIDENCE */}
          {confPct != null && (
            <>
              <SecHead>AI Confidence</SecHead>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${confPct}%` }} />
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0 w-10 text-right">{confPct}%</span>
              </div>
            </>
          )}

          {/* 9. RADIOLOGIST NOTES */}
          {status !== 'pending' && local.reviewer_notes && (
            <>
              <SecHead>Radiologist Notes</SecHead>
              <div className="bg-indigo-50 rounded-lg px-3 py-2 text-xs text-indigo-800 border border-indigo-100">
                {local.reviewer_notes}
              </div>
            </>
          )}

          {/* ── Edit form ── */}
          {editOpen && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-3 max-h-[70vh] overflow-y-auto mt-3">
              <p className="text-xs font-bold text-gray-700 sticky top-0 bg-gray-50 pb-1">Edit Finding</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FL>Finding Type</FL>
                  <FS value={form.finding_type} onChange={setF('finding_type')}>
                    <option value="">— select —</option>
                    {FINDING_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </FS>
                </div>
                <div>
                  <FL>Breast Side</FL>
                  <div className="flex gap-1 mt-0.5">
                    <SideBtn label="Left"  active={form.breast_side === 'L'} onClick={() => setSide('L')} />
                    <SideBtn label="Right" active={form.breast_side === 'R'} onClick={() => setSide('R')} />
                    <SideBtn label="Both"  active={form.breast_side === 'B'} onClick={() => setSide('B')} />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-blue-400 mb-1.5">Location</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><FL>Clock Position</FL>
                    <FS value={form.clock_position} onChange={setF('clock_position')}>
                      <option value="">—</option>
                      {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{i+1} o'clock</option>)}
                    </FS>
                  </div>
                  <div><FL>Quadrant</FL>
                    <FS value={form.quadrant} onChange={setF('quadrant')}>
                      <option value="">—</option>
                      {QUADRANTS.map(q => <option key={q} value={q}>{q.replace(/_/g, ' ')}</option>)}
                    </FS>
                  </div>
                  <div><FL>Distance from Nipple (mm)</FL>
                    <FI type="number" value={form.distance_from_nipple_mm} onChange={setF('distance_from_nipple_mm')} placeholder="e.g. 25" min={0} />
                  </div>
                  <div><FL>Depth</FL>
                    <FS value={form.depth} onChange={setF('depth')}>
                      <option value="">—</option>
                      {DEPTHS.map(d => <option key={d} value={d}>{d}</option>)}
                    </FS>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-blue-400 mb-1.5">Size & Morphology</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><FL>Size — Length (mm)</FL><FI type="number" value={form.size_length_mm} onChange={setF('size_length_mm')} placeholder="length" min={0} step={0.1} /></div>
                  <div><FL>Size — Width (mm)</FL><FI type="number" value={form.size_width_mm} onChange={setF('size_width_mm')} placeholder="width" min={0} step={0.1} /></div>
                  <div><FL>Shape</FL>
                    <FS value={form.shape} onChange={setF('shape')}>
                      <option value="">—</option>
                      {SHAPES.map(s => <option key={s} value={s}>{s}</option>)}
                    </FS>
                  </div>
                  <div><FL>Margin</FL>
                    <FS value={form.margin_type} onChange={setF('margin_type')}>
                      <option value="">—</option>
                      {MARGINS.map(m => <option key={m} value={m}>{m}</option>)}
                    </FS>
                  </div>
                  <div><FL>Density</FL>
                    <FS value={form.density_level} onChange={setF('density_level')}>
                      <option value="">—</option>
                      {DENSITIES.map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
                    </FS>
                  </div>
                </div>
              </div>
              {isCalc && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-blue-400 mb-1.5">Calcification</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div><FL>Morphology</FL>
                      <FS value={form.calcification_morphology} onChange={setF('calcification_morphology')}>
                        <option value="">—</option>
                        {CALC_MORPHS.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                      </FS>
                    </div>
                    <div><FL>Distribution</FL>
                      <FS value={form.calcification_distribution} onChange={setF('calcification_distribution')}>
                        <option value="">—</option>
                        {CALC_DISTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </FS>
                    </div>
                  </div>
                </div>
              )}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-blue-400 mb-1.5">Assessment</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div><FL>BI-RADS</FL>
                    <FS value={form.bi_rads_suggestion} onChange={setF('bi_rads_suggestion')}>
                      <option value="">—</option>
                      {[0,1,2,3,4,5,6].map(n => <option key={n} value={n}>BI-RADS {n}</option>)}
                    </FS>
                  </div>
                  <div><FL>Malignancy Probability (%)</FL>
                    <FI type="number" value={form.malignancy_probability} onChange={setF('malignancy_probability')} placeholder="0–100" min={0} max={100} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div><FL>Recommended Action</FL>
                    <FT value={form.recommended_action} onChange={setF('recommended_action')} placeholder="e.g. Ultrasound guided biopsy within 2 weeks" rows={2} />
                  </div>
                  <div><FL>Clinical Assessment / AI Reasoning</FL>
                    <FT value={form.ai_reasoning} onChange={setF('ai_reasoning')} placeholder="Clinical notes…" rows={3} />
                  </div>
                </div>
              </div>
              <div>
                <FL>Radiologist Notes (internal)</FL>
                <FT value={form.reviewer_notes} onChange={setF('reviewer_notes')} placeholder="Reason for modification or additional notes…" rows={2} />
              </div>
              {saveError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</div>
              )}
              <div className="flex gap-2 sticky bottom-0 bg-gray-50 pt-1">
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 text-xs py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button onClick={() => { setEditOpen(false); setSaveError(null); }}
                  className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {saveError && !editOpen && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</div>
          )}

          {/* ── Review actions ── */}
          {!editOpen && !disabled && (
            <div className="flex gap-2 pt-3 mt-1 border-t border-gray-100">
              {!isDone ? (
                <>
                  <button onClick={() => quickAction('accepted')} disabled={saving}
                    className="flex-1 text-xs py-2 rounded-lg bg-green-50 text-green-700 border border-green-200 font-semibold hover:bg-green-100 disabled:opacity-50">
                    Accept Finding
                  </button>
                  <button onClick={() => quickAction('modified')} disabled={saving}
                    className="flex-1 text-xs py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-semibold hover:bg-blue-100 disabled:opacity-50">
                    Edit & Modify
                  </button>
                  <button onClick={() => quickAction('rejected')} disabled={saving}
                    className="flex-1 text-xs py-2 rounded-lg bg-red-50 text-red-600 border border-red-200 font-semibold hover:bg-red-100 disabled:opacity-50">
                    Reject
                  </button>
                </>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <button onClick={() => { setStatus('pending'); setEditOpen(false); }}
                    className="text-xs text-gray-400 hover:text-gray-600 underline">
                    Undo
                  </button>
                  {status === 'accepted' && (
                    <button onClick={() => quickAction('modified')}
                      className="text-xs text-blue-500 hover:text-blue-700 underline">
                      Edit values
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
