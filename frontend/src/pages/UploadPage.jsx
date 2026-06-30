import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadDicom, uploadZip } from '../services/api';

// ── Shared tiny form primitives ───────────────────────────────────────────────

const FIELD = ({ label, children, hint }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children}
    {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
  </div>
);

const INPUT = ({ value, onChange, type = 'text', ...rest }) => (
  <input
    type={type}
    value={value}
    onChange={onChange}
    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
    {...rest}
  />
);

const SELECT = ({ value, onChange, children }) => (
  <select
    value={value}
    onChange={onChange}
    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
  >
    {children}
  </select>
);

const CHECKBOX = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
    <input type="checkbox" checked={checked} onChange={onChange} className="w-4 h-4 accent-blue-600" />
    {label}
  </label>
);

// ── DICOM upload form ─────────────────────────────────────────────────────────

function DicomForm() {
  const navigate   = useNavigate();
  const [file,     setFile]     = useState(null);
  const [uploading,setUploading]= useState(false);
  const [error,    setError]    = useState(null);

  const [form, setForm] = useState({
    case_type:               'concerning',
    patient_name:            '',
    patient_id:              '',
    age:                     50,
    sex:                     'F',
    study_date:              '',
    family_history:          false,
    personal_breast_cancer:  false,
    brca_mutation:           'unknown',
    menopause_status:        'unknown',
    hormone_therapy:         false,
    breast_implants:         false,
    previous_surgery:        false,
    previous_biopsy:         false,
    reported_lump:           false,
    reported_pain:           false,
    reported_nipple_discharge: false,
  });

  const set = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: val }));
  };

  const handleSubmit = async () => {
    if (!file) { setError('Please select a DICOM file (.dcm)'); return; }
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      const res = await uploadDicom(fd);
      navigate(`/analysis/${res.data.case_id}`);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map(d => d.msg).join(', ')
          : `Upload failed (${err.response?.status || 'no response'}). Is the backend running on port 8000?`;
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* File picker */}
      <section className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold text-gray-700 mb-3">DICOM File</h2>
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${
            file ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300'
          }`}
          onClick={() => document.getElementById('dcmInput').click()}
        >
          {file ? (
            <p className="text-blue-700 font-medium">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
          ) : (
            <>
              <p className="text-3xl mb-2">📁</p>
              <p className="text-gray-600 font-medium text-sm">Click to select a .dcm file</p>
              <p className="text-gray-400 text-xs mt-1">Supports 2D FFDM and multi-frame tomosynthesis (DBT)</p>
            </>
          )}
          <input id="dcmInput" type="file" accept=".dcm" className="hidden"
            onChange={(e) => setFile(e.target.files[0])} />
        </div>
      </section>

      {/* Patient Info */}
      <section className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold text-gray-700 mb-4">Patient Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <FIELD label="Patient Name">
            <INPUT value={form.patient_name} onChange={set('patient_name')} placeholder="Jane Doe" />
          </FIELD>
          <FIELD label="Patient ID">
            <INPUT value={form.patient_id} onChange={set('patient_id')} placeholder="P-12345" />
          </FIELD>
          <FIELD label="Age">
            <INPUT type="number" value={form.age} onChange={set('age')} min={18} max={100} />
          </FIELD>
          <FIELD label="Sex">
            <SELECT value={form.sex} onChange={set('sex')}>
              <option value="F">Female</option>
              <option value="M">Male</option>
            </SELECT>
          </FIELD>
          <FIELD label="Study Date">
            <INPUT type="date" value={form.study_date} onChange={set('study_date')} />
          </FIELD>
          <FIELD label="Demo Case Type" hint="Controls AI mock output for demo">
            <SELECT value={form.case_type} onChange={set('case_type')}>
              <option value="routine">Routine (BI-RADS 2)</option>
              <option value="concerning">Concerning (BI-RADS 4)</option>
              <option value="urgent">Urgent (BI-RADS 5)</option>
            </SELECT>
          </FIELD>
        </div>
      </section>

      {/* Clinical History */}
      <section className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold text-gray-700 mb-4">Clinical History</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <FIELD label="BRCA Mutation Status">
            <SELECT value={form.brca_mutation} onChange={set('brca_mutation')}>
              <option value="unknown">Unknown</option>
              <option value="negative">Negative</option>
              <option value="positive">Positive</option>
            </SELECT>
          </FIELD>
          <FIELD label="Menopause Status">
            <SELECT value={form.menopause_status} onChange={set('menopause_status')}>
              <option value="unknown">Unknown</option>
              <option value="pre">Pre-menopausal</option>
              <option value="peri">Peri-menopausal</option>
              <option value="post">Post-menopausal</option>
            </SELECT>
          </FIELD>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <CHECKBOX label="Family history of breast cancer"   checked={form.family_history}         onChange={set('family_history')} />
          <CHECKBOX label="Personal history of breast cancer" checked={form.personal_breast_cancer} onChange={set('personal_breast_cancer')} />
          <CHECKBOX label="Hormone replacement therapy (HRT)" checked={form.hormone_therapy}        onChange={set('hormone_therapy')} />
          <CHECKBOX label="Breast implants"                   checked={form.breast_implants}        onChange={set('breast_implants')} />
          <CHECKBOX label="Previous breast surgery"           checked={form.previous_surgery}       onChange={set('previous_surgery')} />
          <CHECKBOX label="Previous biopsy"                   checked={form.previous_biopsy}        onChange={set('previous_biopsy')} />
        </div>
        <div className="mt-4 border-t pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Clinical Presentation</p>
          <div className="grid grid-cols-3 gap-3">
            <CHECKBOX label="Reported lump"    checked={form.reported_lump}             onChange={set('reported_lump')} />
            <CHECKBOX label="Reported pain"    checked={form.reported_pain}             onChange={set('reported_pain')} />
            <CHECKBOX label="Nipple discharge" checked={form.reported_nipple_discharge} onChange={set('reported_nipple_discharge')} />
          </div>
        </div>
      </section>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded text-sm">{error}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={uploading}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? 'Uploading & Analyzing…' : 'Upload & Analyze'}
      </button>
    </div>
  );
}

// ── ZIP upload form ───────────────────────────────────────────────────────────

const ZIP_DEFAULTS = {
  age: 50, sex: 'F', menopause_status: 'unknown', brca_mutation: 'unknown',
  urgency: '', // empty = auto-detect from PATIENT_META
  family_history: false, personal_breast_cancer: false,
  hormone_therapy: false, breast_implants: false,
  previous_surgery: false, previous_biopsy: false,
  reported_lump: false, reported_pain: false, reported_nipple_discharge: false,
};

function ZipForm() {
  const navigate         = useNavigate();
  const [file,           setFile]           = useState(null);
  const [uploading,      setUploading]      = useState(false);
  const [result,         setResult]         = useState(null);
  const [error,          setError]          = useState(null);
  const [showDefaults,   setShowDefaults]   = useState(false);
  const [defaults,       setDefaults]       = useState(ZIP_DEFAULTS);

  const setD = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setDefaults((d) => ({ ...d, [key]: val }));
  };

  const handleUpload = async () => {
    if (!file) { setError('Please select a ZIP file'); return; }
    setError(null);
    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (showDefaults) {
        fd.append('age',                     defaults.age);
        fd.append('sex',                     defaults.sex);
        fd.append('menopause_status',        defaults.menopause_status);
        fd.append('brca_mutation',           defaults.brca_mutation);
        fd.append('family_history',          defaults.family_history);
        fd.append('personal_breast_cancer',  defaults.personal_breast_cancer);
        fd.append('hormone_therapy',         defaults.hormone_therapy);
        fd.append('breast_implants',         defaults.breast_implants);
        fd.append('previous_surgery',        defaults.previous_surgery);
        fd.append('previous_biopsy',         defaults.previous_biopsy);
        fd.append('reported_lump',           defaults.reported_lump);
        fd.append('reported_pain',           defaults.reported_pain);
        fd.append('reported_nipple_discharge', defaults.reported_nipple_discharge);
        if (defaults.urgency) fd.append('urgency', defaults.urgency);
      }
      const res = await uploadZip(fd);
      setResult(res.data);
      const imported = res.data.results?.filter(r => r.status === 'imported');
      if (imported?.length === 1) {
        navigate(`/analysis/${imported[0].case_id}`);
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : `Upload failed (${err.response?.status || 'no response'})`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-sm text-violet-800">
        <p className="font-semibold mb-1">Expected ZIP format</p>
        <p className="text-xs text-violet-600">
          ZIP should contain one or more patient folders (e.g. <code className="bg-violet-100 px-1 rounded">CH27001234/</code>),
          each holding FUJIFILM PACS JPG exports or DICOM files (<code className="bg-violet-100 px-1 rounded">.dcm</code>).
          Multi-frame tomosynthesis DICOMs are supported — frames are extracted automatically.
          Patient ID and series type are auto-detected.
        </p>
      </div>

      {/* File picker */}
      <section className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold text-gray-700 mb-3">Patient ZIP File</h2>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
            file ? 'border-violet-400 bg-violet-50' : 'border-gray-300 hover:border-violet-300'
          }`}
          onClick={() => document.getElementById('zipInput').click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.name.endsWith('.zip')) setFile(f); }}
        >
          {file ? (
            <div>
              <p className="text-violet-700 font-semibold text-lg">📦 {file.name}</p>
              <p className="text-violet-500 text-sm mt-1">{(file.size / (1024 * 1024)).toFixed(1)} MB — ready to upload</p>
              <button
                className="mt-2 text-xs text-gray-400 underline"
                onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); }}
              >
                remove
              </button>
            </div>
          ) : (
            <>
              <p className="text-4xl mb-3">📦</p>
              <p className="font-medium text-gray-600">Click or drag & drop a .zip file here</p>
              <p className="text-gray-400 text-sm mt-1">One or more patient folders inside</p>
            </>
          )}
          <input id="zipInput" type="file" accept=".zip" className="hidden"
            onChange={(e) => { setFile(e.target.files[0]); setResult(null); }} />
        </div>
      </section>

      {/* Patient defaults — collapsible */}
      <section className="bg-white rounded-xl shadow overflow-hidden">
        <button
          onClick={() => setShowDefaults(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
        >
          <div>
            <p className="font-semibold text-gray-700 text-sm">Patient Defaults</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {showDefaults ? 'Applied to all patients in this ZIP' : 'Optional — expand to set clinical data for imported patients'}
            </p>
          </div>
          <span className="text-gray-400 text-lg select-none">{showDefaults ? '▲' : '▼'}</span>
        </button>

        {showDefaults && (
          <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              These values apply to <strong>all</strong> patients in the ZIP. For known patients the system may have more specific data — your values here take priority.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <FIELD label="Age">
                <INPUT type="number" value={defaults.age} onChange={setD('age')} min={18} max={100} />
              </FIELD>
              <FIELD label="Sex">
                <SELECT value={defaults.sex} onChange={setD('sex')}>
                  <option value="F">Female</option>
                  <option value="M">Male</option>
                </SELECT>
              </FIELD>
              <FIELD label="Menopause Status">
                <SELECT value={defaults.menopause_status} onChange={setD('menopause_status')}>
                  <option value="unknown">Unknown</option>
                  <option value="pre">Pre-menopausal</option>
                  <option value="peri">Peri-menopausal</option>
                  <option value="post">Post-menopausal</option>
                </SELECT>
              </FIELD>
              <FIELD label="BRCA Mutation">
                <SELECT value={defaults.brca_mutation} onChange={setD('brca_mutation')}>
                  <option value="unknown">Unknown</option>
                  <option value="negative">Negative</option>
                  <option value="positive">Positive</option>
                </SELECT>
              </FIELD>
              <FIELD label="Urgency Override" hint="Leave blank for auto-detect">
                <SELECT value={defaults.urgency} onChange={setD('urgency')}>
                  <option value="">Auto (from patient data)</option>
                  <option value="routine">Routine</option>
                  <option value="concerning">Concerning</option>
                  <option value="urgent">Urgent</option>
                </SELECT>
              </FIELD>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Clinical History</p>
              <div className="grid grid-cols-2 gap-3">
                <CHECKBOX label="Family history (breast cancer)" checked={defaults.family_history}        onChange={setD('family_history')} />
                <CHECKBOX label="Personal history (breast cancer)" checked={defaults.personal_breast_cancer} onChange={setD('personal_breast_cancer')} />
                <CHECKBOX label="Hormone replacement therapy"    checked={defaults.hormone_therapy}       onChange={setD('hormone_therapy')} />
                <CHECKBOX label="Breast implants"                checked={defaults.breast_implants}       onChange={setD('breast_implants')} />
                <CHECKBOX label="Previous breast surgery"        checked={defaults.previous_surgery}      onChange={setD('previous_surgery')} />
                <CHECKBOX label="Previous biopsy"                checked={defaults.previous_biopsy}       onChange={setD('previous_biopsy')} />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Reported Symptoms</p>
              <div className="grid grid-cols-3 gap-3">
                <CHECKBOX label="Lump"              checked={defaults.reported_lump}              onChange={setD('reported_lump')} />
                <CHECKBOX label="Pain"              checked={defaults.reported_pain}              onChange={setD('reported_pain')} />
                <CHECKBOX label="Nipple discharge"  checked={defaults.reported_nipple_discharge}  onChange={setD('reported_nipple_discharge')} />
              </div>
            </div>
          </div>
        )}
      </section>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded text-sm">{error}</div>
      )}

      {/* Results */}
      {result && (
        <div className={`rounded-xl border p-4 text-sm ${result.errors > 0 ? 'bg-amber-50 border-amber-300' : 'bg-green-50 border-green-300'}`}>
          <p className="font-semibold text-gray-800 mb-2">
            Import complete — {result.imported} imported, {result.skipped} skipped, {result.errors} errors
          </p>
          <div className="space-y-1">
            {result.results?.map(r => (
              <div key={r.patient_id} className="flex items-center gap-2 text-xs">
                <span className={`px-1.5 py-0.5 rounded font-semibold ${
                  r.status === 'imported' ? 'bg-green-200 text-green-800' :
                  r.status === 'skipped'  ? 'bg-gray-200 text-gray-600' :
                  'bg-red-200 text-red-800'
                }`}>{r.status}</span>
                <span className="font-mono text-gray-700">{r.patient_id}</span>
                {r.status === 'imported' && (
                  <span className="text-gray-500">
                    {r.series_type} · {r.total_slices} slices ·{' '}
                    <button
                      className="text-blue-600 underline"
                      onClick={() => navigate(`/analysis/${r.case_id}`)}
                    >
                      View →
                    </button>
                  </span>
                )}
                {r.status === 'error' && <span className="text-red-600">{r.error}</span>}
                {r.status === 'skipped' && <span className="text-gray-400">{r.reason}</span>}
              </div>
            ))}
          </div>
          {result.imported > 0 && (
            <button
              onClick={() => navigate('/')}
              className="mt-3 text-xs text-blue-600 underline"
            >
              ← Back to worklist
            </button>
          )}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={uploading || !file}
        className="w-full bg-violet-600 text-white py-3 rounded-lg font-semibold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading
          ? <span className="flex items-center justify-center gap-2">
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block"></span>
              Extracting & Importing…
            </span>
          : '⬆ Upload & Import'}
      </button>
    </div>
  );
}

// ── Main page with mode switcher ──────────────────────────────────────────────

export default function UploadPage() {
  const [mode, setMode] = useState('dicom');

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Upload Study</h1>
      <p className="text-sm text-gray-400 mb-6">Choose the format matching your data source</p>

      {/* Mode switcher */}
      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setMode('dicom')}
          className={`px-5 py-2 rounded-md text-sm font-semibold transition ${
            mode === 'dicom'
              ? 'bg-white shadow text-blue-700'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🩻 DICOM File
        </button>
        <button
          onClick={() => setMode('zip')}
          className={`px-5 py-2 rounded-md text-sm font-semibold transition ${
            mode === 'zip'
              ? 'bg-white shadow text-violet-700'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📦 Patient ZIP
        </button>
      </div>

      {mode === 'dicom' ? <DicomForm /> : <ZipForm />}
    </div>
  );
}
