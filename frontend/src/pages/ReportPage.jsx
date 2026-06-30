import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCaseDetail, signOffCase, saveReport, updateCaseAssessment } from '../services/api';

// ── Config ────────────────────────────────────────────────────────────────────
const BIRADS_COLOR = {
  0: 'bg-gray-500',   1: 'bg-green-500',  2: 'bg-green-600',
  3: 'bg-yellow-500', 4: 'bg-orange-500', 5: 'bg-red-600', 6: 'bg-purple-700',
};
const BIRADS_LABEL = {
  0: 'Incomplete', 1: 'Negative', 2: 'Benign', 3: 'Probably Benign',
  4: 'Suspicious', 5: 'Highly Suspicious', 6: 'Known Malignancy',
};
const BIRADS_INFO = {
  0: 'Additional imaging is required before a final assessment can be made.',
  1: 'No evidence of malignancy. Routine annual screening recommended.',
  2: 'Definitely benign finding(s) identified. No malignancy risk.',
  3: 'Less than 2% risk of malignancy. Short-interval follow-up recommended.',
  4: 'Tissue sampling is required.',
  5: 'Greater than 95% probability of malignancy. Biopsy and treatment planning required.',
  6: 'Biopsy-proven malignancy. Coordinate with oncology for treatment planning.',
};
const URGENCY_COLOR = {
  urgent:     'text-red-400 bg-red-950 border-red-800',
  concerning: 'text-amber-400 bg-amber-950 border-amber-800',
  routine:    'text-green-400 bg-green-950 border-green-800',
};
const MGMT_TEXT = {
  routine_screening:       'Routine annual mammography screening is recommended.',
  short_interval_followup: 'Short-interval (6-month) follow-up mammogram is recommended to assess stability.',
  additional_imaging:      'Diagnostic imaging workup (targeted ultrasound and/or spot compression views) is recommended within 1–2 weeks.',
  tissue_sampling:         'Image-guided core needle biopsy is recommended. Clinical correlation is advised.',
  urgent_tissue_sampling:  'URGENT: Image-guided core needle biopsy and surgical referral are strongly recommended. The patient should be contacted immediately.',
};

// ── Print styles ──────────────────────────────────────────────────────────────
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #report-print-area, #report-print-area * { visibility: visible !important; }
  #report-print-area {
    position: fixed !important; top: 0; left: 0; width: 100%;
    padding: 32px; background: white; color: black;
    font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6;
  }
  .no-print { display: none !important; }
}
`;

// ── Report text helpers ───────────────────────────────────────────────────────
function describeFinding(f) {
  const side = f.breast_side === 'L' ? 'left' : f.breast_side === 'R' ? 'right' : 'bilateral';
  const type = (f.finding_type || 'lesion').replace(/_/g, ' ');
  const adjs = [f.shape, f.density_level && `${f.density_level.replace(/_/g, '-')} density`].filter(Boolean);
  let s1 = adjs.length ? `An ${adjs.join(', ')} ${type}` : `A ${type}`;
  if (f.margin_type) s1 += ` with ${f.margin_type} margins`;
  s1 += ` is present in the ${side} breast.`;
  const parts = [s1];
  const loc = [
    f.quadrant             && `${f.quadrant.replace(/_/g, ' ')} quadrant`,
    f.clock_position       && `${f.clock_position} o'clock position`,
    f.depth                && `${f.depth} depth`,
    f.distance_from_nipple_mm && `approximately ${f.distance_from_nipple_mm} mm from the nipple`,
  ].filter(Boolean);
  if (loc.length) parts.push(`Located at the ${loc.join(', ')}.`);
  if (f.size_length_mm) parts.push(`The lesion measures ${f.size_length_mm}${f.size_width_mm ? ` × ${f.size_width_mm}` : ''} mm.`);
  return parts.join(' ');
}

function impressionLine(f) {
  const side = f.breast_side === 'L' ? 'left' : f.breast_side === 'R' ? 'right' : 'bilateral';
  const type = (f.finding_type || 'lesion').replace(/_/g, ' ');
  const adjs = [f.shape, f.margin_type].filter(Boolean);
  const loc  = [f.quadrant && f.quadrant.replace(/_/g, ' '), f.clock_position && `${f.clock_position} o'clock`].filter(Boolean);
  let line   = adjs.length ? `${adjs.join(' ')} ${type}` : type;
  if (loc.length) line += ` in the ${loc.join(', ')} of the ${side} breast`;
  if (f.bi_rads_suggestion != null) line += ` (BI-RADS ${f.bi_rads_suggestion})`;
  return line.charAt(0).toUpperCase() + line.slice(1) + '.';
}

// ── Section heading ───────────────────────────────────────────────────────────
function RS({ title, children }) {
  return (
    <div>
      <p className="text-[9px] font-bold tracking-widest uppercase text-gray-400 border-b border-gray-200 pb-0.5 mb-1.5">
        {title}
      </p>
      <div className="pl-0.5">{children}</div>
    </div>
  );
}

// ── Printable area ────────────────────────────────────────────────────────────
function PrintArea({ caseData, findings, reportText }) {
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const leftF  = findings.filter(f => f.breast_side === 'L');
  const rightF = findings.filter(f => f.breast_side === 'R');
  const otherF = findings.filter(f => f.breast_side !== 'L' && f.breast_side !== 'R');
  return (
    <div id="report-print-area">
      <h1 style={{ fontFamily: 'serif', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 }}>
        MAMMOGRAPHY REPORT
      </h1>
      <div style={{ borderBottom: '2px solid black', marginBottom: 16 }} />
      <p><strong>Patient:</strong> {caseData.patient_name || 'Anonymous'} &nbsp; <strong>ID:</strong> {caseData.patient_id}</p>
      <p><strong>Age/Sex:</strong> {caseData.age}y / {caseData.sex} &nbsp; <strong>Study Date:</strong> {caseData.study_date || today}</p>
      <p><strong>Modality:</strong> {caseData.series_type === 'tomosynthesis' ? 'Digital Breast Tomosynthesis (DBT)' : '2D FFDM Mammography'}</p>
      <div style={{ borderBottom: '1px solid #ccc', margin: '12px 0' }} />
      <p><strong>BREAST COMPOSITION</strong></p>
      <p>{{
        A: 'Almost entirely fatty (ACR Category A). Mammographic sensitivity is high.',
        B: 'Scattered areas of fibroglandular density (ACR Category B).',
        C: 'Heterogeneously dense (ACR Category C), which may obscure small masses.',
        D: 'Extremely dense (ACR Category D), which significantly lowers mammographic sensitivity.',
      }[caseData.density_category] || '—'}</p>
      <div style={{ borderBottom: '1px solid #ccc', margin: '12px 0' }} />
      <p><strong>FINDINGS</strong></p>
      <p><em>Left breast:</em></p>
      {leftF.length === 0 ? <p>No suspicious mass, architectural distortion, or suspicious calcifications.</p>
        : leftF.map((f, i) => <p key={i}>{i + 1}. {describeFinding(f)}</p>)}
      <p><em>Right breast:</em></p>
      {rightF.length === 0 ? <p>No suspicious mass, architectural distortion, or suspicious calcifications.</p>
        : rightF.map((f, i) => <p key={i}>{i + 1}. {describeFinding(f)}</p>)}
      {otherF.length > 0 && <>{otherF.map((f, i) => <p key={i}>{describeFinding(f)}</p>)}</>}
      <div style={{ borderBottom: '1px solid #ccc', margin: '12px 0' }} />
      <p><strong>IMPRESSION</strong></p>
      {findings.length === 0 ? <p>No mammographically suspicious findings identified.</p>
        : findings.map((f, i) => <p key={i}>{impressionLine(f)}</p>)}
      {caseData.overall_impression && <p style={{ marginTop: 8 }}>{caseData.overall_impression}</p>}
      <p style={{ marginTop: 8 }}><strong>BI-RADS {caseData.overall_birads} — {BIRADS_LABEL[caseData.overall_birads]}</strong></p>
      <div style={{ borderBottom: '1px solid #ccc', margin: '12px 0' }} />
      <p><strong>RECOMMENDATION</strong></p>
      <p>{MGMT_TEXT[caseData.recommended_management] || '—'}</p>
      {reportText && <p style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{reportText}</p>}
      <div style={{ borderBottom: '2px solid black', margin: '20px 0 12px' }} />
      <p>Radiologist: _________________________________ &nbsp; Date: ________________</p>
      <p style={{ fontSize: 9, color: '#666', marginTop: 12 }}>
        AI-GENERATED DRAFT — Reviewed and signed off by the radiologist above. Detection: {caseData.cv_model || 'AI'}
      </p>
    </div>
  );
}

// ── Main ReportPage ───────────────────────────────────────────────────────────
export default function ReportPage() {
  const { caseId } = useParams();
  const navigate   = useNavigate();

  const [caseData,    setCaseData]    = useState(null);
  const [findings,    setFindings]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [reportText,  setReportText]  = useState('');
  const [reportSaved, setReportSaved] = useState(false);
  const [signingOff,  setSigningOff]  = useState(false);
  const [signedOff,   setSignedOff]   = useState(false);
  const [editing,     setEditing]     = useState(false);
  const [editedText,  setEditedText]  = useState('');
  const [copied,      setCopied]      = useState(false);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = PRINT_CSS;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    getCaseDetail(caseId).then(res => {
      const c = res.data.case;
      const f = res.data.findings || [];
      setCaseData(c);
      setFindings(f);
      setSignedOff(!!c.signed_off);
      setReportText(c.final_report_text || '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [caseId]);

  const buildPlainText = useCallback(() => {
    if (!caseData) return '';
    const DIV  = '═══════════════════════════════════════════';
    const THIN = '───────────────────────────────────────────';
    const sec  = (t) => ['', t, THIN];
    const today = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
    const leftF  = findings.filter(f => f.breast_side === 'L');
    const rightF = findings.filter(f => f.breast_side === 'R');
    const otherF = findings.filter(f => f.breast_side !== 'L' && f.breast_side !== 'R');
    const examText = {
      tomosynthesis: 'Digital bilateral mammography with digital breast tomosynthesis (DBT, 3D).',
      transpara:     'Digital bilateral mammography with Transpara AI-enhanced processing.',
      '2d':          'Digital bilateral full-field digital mammography (FFDM).',
    }[caseData.series_type] || 'Digital bilateral mammography.';
    const densityText = {
      A: 'Almost entirely fatty (ACR Category A). Mammographic sensitivity is high.',
      B: 'Scattered areas of fibroglandular density (ACR Category B).',
      C: 'Heterogeneously dense (ACR Category C), which may obscure small masses.',
      D: 'Extremely dense (ACR Category D), which lowers the sensitivity of mammography.',
    }[caseData.density_category] || 'Breast density not assessed.';
    const lines = [
      'MAMMOGRAPHY REPORT', DIV,
      ...sec('PATIENT INFORMATION'),
      `Patient:      ${caseData.patient_name || 'Anonymous'}`,
      `Patient ID:   ${caseData.patient_id}`,
      `Age / Sex:    ${caseData.age}y / ${caseData.sex === 'F' ? 'Female' : 'Male'}`,
      `Study Date:   ${caseData.study_date || 'Not recorded'}`,
      `Report Date:  ${today}`,
      ...sec('EXAMINATION'),
      examText,
      ...sec('BREAST COMPOSITION'),
      densityText,
      ...sec('FINDINGS'),
      '', 'Left breast:',
    ];
    if (leftF.length === 0) lines.push('  No suspicious mass, architectural distortion, or suspicious calcifications.');
    else leftF.forEach((f, i) => lines.push(`  ${i + 1}. ${describeFinding(f)}`));
    lines.push('', 'Right breast:');
    if (rightF.length === 0) lines.push('  No suspicious mass, architectural distortion, or suspicious calcifications.');
    else rightF.forEach((f, i) => lines.push(`  ${i + 1}. ${describeFinding(f)}`));
    if (otherF.length > 0) { lines.push('', 'Additional:'); otherF.forEach(f => lines.push(`  ${describeFinding(f)}`)); }
    lines.push(...sec('IMPRESSION'));
    if (findings.length === 0) lines.push('No mammographically suspicious findings identified.');
    else findings.forEach(f => lines.push(impressionLine(f)));
    if (caseData.overall_impression) lines.push('', caseData.overall_impression);
    lines.push(
      '', `BI-RADS Category ${caseData.overall_birads ?? '—'} — ${BIRADS_LABEL[caseData.overall_birads] || '—'}`,
      BIRADS_INFO[caseData.overall_birads] || '',
      ...sec('RECOMMENDATION'),
      MGMT_TEXT[caseData.recommended_management] || '—',
      '', DIV,
      signedOff
        ? 'REVIEWED AND SIGNED OFF BY RADIOLOGIST'
        : 'AI-GENERATED DRAFT — REQUIRES RADIOLOGIST REVIEW AND SIGN-OFF',
    );
    if (!signedOff) lines.push('', 'Radiologist: _________________________   Date: _______________');
    lines.push(DIV);
    if (reportText) lines.push('', 'RADIOLOGIST NOTES:', reportText);
    return lines.join('\n');
  }, [caseData, findings, signedOff, reportText]);

  const handleCopy = () => {
    navigator.clipboard.writeText(buildPlainText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPdf = () => {
    const pid     = (caseData.patient_id || 'Patient').replace(/\s+/g, '_');
    const dateStr = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
    const safe    = buildPlainText().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Mammography Report — ${pid}</title>
<style>
  @page { size: A4; margin: 2.2cm 2cm; }
  body { font-family: 'Courier New', monospace; font-size: 10.5pt; line-height: 1.65; color: #111; }
  .wrapper { max-width: 680px; margin: 0 auto; padding: 20px 0; }
  .hdr { font-family: Arial, sans-serif; font-size: 8pt; color: #888; text-align: center; border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 24px; }
  pre { font-family: inherit; font-size: inherit; white-space: pre-wrap; word-break: break-word; }
  .ftr { margin-top: 32px; padding-top: 10px; border-top: 1px solid #ccc; font-family: Arial, sans-serif; font-size: 8pt; color: #777; }
</style>
</head><body>
<div class="wrapper">
  <div class="hdr">RADIOLOGY CARE — AI-ASSISTED MAMMOGRAPHY PLATFORM | ${dateStr}</div>
  <pre>${safe}</pre>
  <div class="ftr">Generated by Radiology Care · AI-assisted draft · Requires radiologist sign-off before clinical use</div>
</div>
<script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>
</body></html>`;
    const win = window.open('', '_blank', 'width=820,height=1000,scrollbars=yes');
    if (!win) { alert('Pop-up blocked. Allow pop-ups to download PDF.'); return; }
    win.document.open(); win.document.write(html); win.document.close();
  };

  const handleSaveReport = async () => {
    await saveReport(caseId, reportText);
    setReportSaved(true);
    setTimeout(() => setReportSaved(false), 2000);
  };

  const handleSignOff = async () => {
    if (!window.confirm('Sign off this case? This will lock all findings.')) return;
    setSigningOff(true);
    await signOffCase(caseId);
    setSignedOff(true);
    setSigningOff(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-white">
      <p className="text-gray-400 text-sm animate-pulse">Loading report...</p>
    </div>
  );
  if (!caseData) return (
    <div className="flex items-center justify-center h-screen bg-white">
      <p className="text-red-400 text-sm">Case not found.</p>
    </div>
  );

  const urgency = caseData.overall_case_urgency || 'routine';
  const birads  = caseData.overall_birads;
  const leftF   = findings.filter(f => f.breast_side === 'L');
  const rightF  = findings.filter(f => f.breast_side === 'R');
  const otherF  = findings.filter(f => f.breast_side !== 'L' && f.breast_side !== 'R');
  const today   = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  const examText = {
    tomosynthesis: 'Digital bilateral mammography with digital breast tomosynthesis (DBT, 3D).',
    transpara:     'Digital bilateral mammography with Transpara AI-enhanced processing.',
    '2d':          'Digital bilateral full-field digital mammography (FFDM).',
  }[caseData.series_type] || 'Digital bilateral mammography.';
  const densityOfficial = {
    A: 'The breasts are almost entirely fatty (ACR Category A). Mammographic sensitivity is high.',
    B: 'There are scattered areas of fibroglandular density (ACR Category B).',
    C: 'The breasts are heterogeneously dense (ACR Category C), which may obscure small masses.',
    D: 'The breasts are extremely dense (ACR Category D), which lowers the sensitivity of mammography.',
  }[caseData.density_category] || 'Breast density not assessed.';

  return (
    <div className="flex flex-col h-screen w-screen bg-white overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-200 bg-white shrink-0 no-print">
        <button onClick={() => navigate(`/analysis/${caseId}`)} className="text-gray-400 hover:text-gray-700 text-sm transition flex-shrink-0">
          ← Analysis
        </button>
        <div className="w-px h-4 bg-gray-200" />
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-700 text-sm transition flex-shrink-0">
          Worklist
        </button>
        <div className="w-px h-4 bg-gray-200" />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{caseData.patient_name || caseData.patient_id}</p>
          <p className="text-xs text-gray-400">{caseData.patient_id}{caseData.age ? ` · ${caseData.age}y` : ''}</p>
        </div>

        {birads != null && (
          <span className={`text-xs font-bold text-white px-3 py-1.5 rounded-lg flex-shrink-0 ${BIRADS_COLOR[birads] || 'bg-gray-500'}`}>
            BI-RADS {birads}
          </span>
        )}
        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border capitalize flex-shrink-0 ${URGENCY_COLOR[urgency]}`}>
          {urgency}
        </span>

        {!signedOff && !editing && (
          <button
            onClick={() => { setEditedText(buildPlainText()); setEditing(true); }}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5 transition no-print flex-shrink-0"
          >
            ✎ Edit Report
          </button>
        )}
        {editing && (
          <>
            <button
              onClick={async () => { await saveReport(caseId, editedText); setReportText(editedText); setEditing(false); setReportSaved(true); setTimeout(() => setReportSaved(false), 2000); }}
              className="text-xs font-semibold bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700 transition no-print flex-shrink-0"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition no-print flex-shrink-0"
            >
              Cancel
            </button>
          </>
        )}
        {reportSaved && <span className="text-xs text-green-600 font-semibold flex-shrink-0">✓ Saved</span>}
        <button onClick={handleCopy} className="text-xs font-semibold text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 transition no-print flex-shrink-0">
          {copied ? '✓ Copied' : '⎘ Copy'}
        </button>
        <button onClick={handleDownloadPdf} className="text-xs font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 transition no-print flex-shrink-0">
          ↓ Download PDF
        </button>
        <button
          onClick={handleSignOff}
          disabled={signingOff || signedOff}
          className={`text-xs font-bold px-4 py-1.5 rounded-lg transition no-print flex-shrink-0 ${
            signedOff
              ? 'bg-green-100 text-green-700 border border-green-300 cursor-default'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {signedOff ? '✓ Signed Off' : signingOff ? 'Signing...' : 'Sign Off'}
        </button>
      </div>

      {/* ── Scrollable report body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Edit mode: full plain-text textarea ── */}
        {editing && (
          <div className="px-12 py-8 h-full flex flex-col">
            <p className="text-xs text-gray-400 mb-3">
              Editing the full report as plain text. Changes are saved when you click Save in the top bar.
            </p>
            <textarea
              value={editedText}
              onChange={e => setEditedText(e.target.value)}
              className="flex-1 w-full font-mono text-xs leading-relaxed text-gray-800 border border-blue-300 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              spellCheck={false}
            />
          </div>
        )}

        {!editing && (
        <div className="px-12 py-8 text-[11px] font-mono leading-relaxed text-gray-800">

          {/* ═══ Header ═══ */}
          <div className="text-center mb-6">
            <p className="font-bold text-base tracking-[0.2em] uppercase text-gray-900">Mammography Report</p>
            <div className="border-b-2 border-gray-800 mt-2" />
          </div>

          {/* CV Detection badge */}
          {caseData.cv_model && caseData.cv_model !== 'none' && (
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">CV Detection Layer</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${caseData.cv_is_neural ? 'bg-green-700 text-green-100' : 'bg-slate-600 text-slate-200'}`}>
                  {caseData.cv_is_neural ? 'Neural' : 'Statistical CV'}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mb-2">{caseData.cv_model}</p>
              {caseData.cv_suspicion_score != null && (
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] text-slate-400">Suspicion score</span>
                      <span className={`text-xs font-bold ${caseData.cv_suspicion_score >= 0.65 ? 'text-red-400' : caseData.cv_suspicion_score >= 0.35 ? 'text-amber-400' : 'text-green-400'}`}>
                        {Math.round(caseData.cv_suspicion_score * 100)}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${caseData.cv_suspicion_score >= 0.65 ? 'bg-red-500' : caseData.cv_suspicion_score >= 0.35 ? 'bg-amber-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.round(caseData.cv_suspicion_score * 100)}%` }}
                      />
                    </div>
                  </div>
                  {caseData.cv_density_class && (
                    <div className="text-center">
                      <p className="text-[9px] text-slate-400">Density</p>
                      <p className="text-lg font-black text-white">ACR {caseData.cv_density_class}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══ Structured report ═══ */}
          <div className="space-y-5">

            <RS title="Patient Information">
              <div className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-0.5 text-[10px]">
                <span className="text-gray-400">Patient</span>
                <span className="font-semibold">{caseData.patient_name || 'Anonymous'}</span>
                <span className="text-gray-400">Patient ID</span>
                <span className="font-mono">{caseData.patient_id}</span>
                <span className="text-gray-400">Age / Sex</span>
                <span>{caseData.age}y / {caseData.sex === 'F' ? 'Female' : 'Male'}</span>
                <span className="text-gray-400">Study Date</span>
                <span>{caseData.study_date || 'Not recorded'}</span>
                <span className="text-gray-400">Report Date</span>
                <span>{today}</span>
                {caseData.referring_physician && <>
                  <span className="text-gray-400">Referring Physician</span>
                  <span>{caseData.referring_physician}</span>
                </>}
              </div>
            </RS>

            <RS title="Examination">
              <p>{examText}</p>
              <p className="mt-0.5">Views obtained: CC and MLO views of both breasts.</p>
            </RS>

            <RS title="Indication">
              <p>Routine screening mammography.</p>
            </RS>

            <RS title="Breast Composition">
              <p>{densityOfficial}</p>
            </RS>

            <RS title="Findings">
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-gray-600 text-[10px] uppercase tracking-wide mb-1">Left breast</p>
                  {leftF.length === 0
                    ? <p className="pl-2 text-gray-500">No suspicious mass, architectural distortion, or suspicious calcifications identified.</p>
                    : leftF.map((f, i) => (
                      <div key={f.id} className="pl-2 mb-2">
                        <p><span className="font-bold">{i + 1}.</span> {describeFinding(f)}</p>
                        {f.calcification_morphology && <p className="pl-3 text-gray-600">Calcification: {f.calcification_morphology.replace(/_/g, ' ')}{f.calcification_distribution ? `, ${f.calcification_distribution} distribution` : ''}.</p>}
                        {f.malignancy_probability != null && (
                          <p className="pl-3 text-gray-500">Malignancy probability: <span className={`font-semibold ${f.malignancy_probability >= 0.7 ? 'text-red-600' : f.malignancy_probability >= 0.4 ? 'text-amber-700' : 'text-green-700'}`}>{(f.malignancy_probability * 100).toFixed(0)}%</span></p>
                        )}
                        {f.ai_reasoning && <p className="pl-3 italic text-gray-500 mt-0.5">"{f.ai_reasoning}"</p>}
                      </div>
                    ))}
                </div>
                <div>
                  <p className="font-semibold text-gray-600 text-[10px] uppercase tracking-wide mb-1">Right breast</p>
                  {rightF.length === 0
                    ? <p className="pl-2 text-gray-500">No suspicious mass, architectural distortion, or suspicious calcifications identified.</p>
                    : rightF.map((f, i) => (
                      <div key={f.id} className="pl-2 mb-2">
                        <p><span className="font-bold">{i + 1}.</span> {describeFinding(f)}</p>
                        {f.malignancy_probability != null && (
                          <p className="pl-3 text-gray-500">Malignancy probability: <span className={`font-semibold ${f.malignancy_probability >= 0.7 ? 'text-red-600' : f.malignancy_probability >= 0.4 ? 'text-amber-700' : 'text-green-700'}`}>{(f.malignancy_probability * 100).toFixed(0)}%</span></p>
                        )}
                        {f.ai_reasoning && <p className="pl-3 italic text-gray-500 mt-0.5">"{f.ai_reasoning}"</p>}
                      </div>
                    ))}
                </div>
                {otherF.length > 0 && (
                  <div>
                    <p className="font-semibold text-gray-600 text-[10px] uppercase tracking-wide mb-1">Bilateral / additional</p>
                    {otherF.map((f, i) => <p key={f.id} className="pl-2">{i + 1}. {describeFinding(f)}</p>)}
                  </div>
                )}
                <div className="pt-2 space-y-0.5 text-[10px]">
                  <p className="font-semibold text-gray-500 uppercase tracking-wide mb-1">Associated findings</p>
                  <p className={caseData.asymmetry_detected    ? 'text-amber-700' : 'text-gray-400'}>{caseData.asymmetry_detected    ? '· Global asymmetry detected.' : '· No global asymmetry.'}</p>
                  <p className={caseData.skin_changes_detected ? 'text-amber-700' : 'text-gray-400'}>{caseData.skin_changes_detected ? '· Skin thickening / retraction noted.' : '· No skin thickening or retraction.'}</p>
                  <p className={caseData.nipple_changes        ? 'text-amber-700' : 'text-gray-400'}>{caseData.nipple_changes        ? '· Nipple changes noted.' : '· No nipple retraction.'}</p>
                  <p className={caseData.lymph_node_abnormal   ? 'text-amber-700' : 'text-gray-400'}>{caseData.lymph_node_abnormal   ? '· Abnormal axillary lymph nodes identified.' : '· No suspicious axillary adenopathy.'}</p>
                </div>
              </div>
            </RS>

            <RS title="Impression">
              {findings.length === 0
                ? <p className="text-green-700">No mammographically suspicious findings identified.</p>
                : <div className="space-y-1">{findings.map(f => <p key={f.id}>{impressionLine(f)}</p>)}</div>}
              {caseData.overall_impression && <p className="mt-2 text-gray-600">{caseData.overall_impression}</p>}
            </RS>

            <RS title="BI-RADS Assessment">
              <p className="font-bold text-gray-900">
                Category {birads ?? '—'} — {BIRADS_LABEL[birads] || '—'}
              </p>
              {birads != null && <p className="mt-0.5 text-gray-600">{BIRADS_INFO[birads]}</p>}
            </RS>

            <RS title="Recommendation">
              <p className="font-semibold">{MGMT_TEXT[caseData.recommended_management] || '—'}</p>
              {findings[0]?.recommended_action && <p className="mt-1 text-gray-600">{findings[0].recommended_action}</p>}
            </RS>

            {/* Sign-off line */}
            {signedOff ? (
              <div className="border-t-2 border-green-500 pt-3">
                <p className="text-[10px] font-bold text-green-700 uppercase tracking-wide">
                  Reviewed and Signed Off by Radiologist
                </p>
              </div>
            ) : (
              <div className="border-t-2 border-amber-400 pt-3">
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                  AI-Generated Draft — Requires Radiologist Review and Sign-Off
                </p>
                <div className="mt-4 grid grid-cols-2 gap-8 text-[10px] text-gray-400">
                  <div><div className="border-b border-gray-400 pb-0.5 mb-0.5" /><p>Radiologist signature</p></div>
                  <div><div className="border-b border-gray-400 pb-0.5 mb-0.5" /><p>Date</p></div>
                </div>
              </div>
            )}

            {/* AI decision support block */}
            {findings.length > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 overflow-hidden">
                <div className="bg-blue-100 border-b border-blue-200 px-3 py-1.5 flex items-center gap-2">
                  <span className="text-[9px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase tracking-widest">AI</span>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-blue-700">AI Decision Support — Not Part of Official Report</p>
                </div>
                <div className="px-3 py-2 space-y-3">
                  {findings.map((f, i) => {
                    const malignPct = f.malignancy_probability != null ? (f.malignancy_probability * 100).toFixed(0) : null;
                    const confPct   = f.confidence_score        != null ? (f.confidence_score       * 100).toFixed(0) : null;
                    const side      = f.breast_side === 'L' ? 'Left' : f.breast_side === 'R' ? 'Right' : 'Bilateral';
                    let features = [];
                    try { features = JSON.parse(f.key_features_json || '[]'); } catch {}
                    return (
                      <div key={f.id} className={i > 0 ? 'border-t border-blue-200 pt-3' : ''}>
                        <p className="font-bold text-blue-900 text-[10px] mb-1">
                          Finding {i + 1}: {(f.finding_type || 'finding').replace(/_/g, ' ')} — {side} breast
                        </p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
                          {malignPct && <>
                            <span className="text-blue-500">Malignancy probability</span>
                            <span className={`font-semibold ${parseInt(malignPct) >= 70 ? 'text-red-600' : parseInt(malignPct) >= 40 ? 'text-amber-700' : 'text-green-700'}`}>{malignPct}%</span>
                          </>}
                          {confPct && <>
                            <span className="text-blue-500">AI confidence</span>
                            <span className="font-semibold text-blue-800">{confPct}%</span>
                          </>}
                        </div>
                        {features.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {features.map((feat, fi) => (
                              <span key={fi} className="text-[9px] bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">{feat}</span>
                            ))}
                          </div>
                        )}
                        {f.ai_reasoning && <p className="mt-1 text-[10px] text-blue-700 italic">{f.ai_reasoning}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Editable radiologist notes */}
            <div>
              <p className="text-[9px] font-bold tracking-widest uppercase text-gray-400 border-b border-gray-200 pb-0.5 mb-2">
                Radiologist Notes {signedOff ? '(read-only)' : '(editable)'}
              </p>
              <textarea
                value={reportText}
                onChange={e => setReportText(e.target.value)}
                disabled={signedOff}
                rows={5}
                placeholder="Add radiologist notes, corrections, or additional clinical observations here…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none disabled:bg-gray-50 disabled:text-gray-400 font-sans"
              />
              {!signedOff && (
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={handleSaveReport}
                    className="text-xs font-semibold bg-gray-800 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition"
                  >
                    Save Notes
                  </button>
                  {reportSaved && <span className="text-xs text-green-600 font-medium">✓ Saved</span>}
                </div>
              )}

            </div>

            {/* Disclaimer */}
            <p className="text-[9px] text-gray-400 border border-gray-100 rounded-lg px-4 py-3 bg-gray-50 leading-relaxed font-sans">
              AI-GENERATED FINDINGS — All findings require radiologist review and sign-off before clinical action.
              Detection: {caseData.cv_model || 'AI'} · Report synthesis: {caseData.ai_model || 'GPT-4.1'}
            </p>

          </div>
        </div>
        )}
      </div>

      {/* Hidden printable area */}
      <div className="hidden">
        <PrintArea caseData={caseData} findings={findings} reportText={reportText} />
      </div>
    </div>
  );
}

