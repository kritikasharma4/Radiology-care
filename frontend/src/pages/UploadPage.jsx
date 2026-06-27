import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadDicom } from '../services/api';

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

export default function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

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
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Upload DICOM Study</h1>

      {/* DICOM File */}
      <section className="bg-white rounded-xl shadow p-5 mb-5">
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
              <p className="text-gray-500 text-sm">Click to select a .dcm file</p>
            </>
          )}
          <input
            id="dcmInput"
            type="file"
            accept=".dcm"
            className="hidden"
            onChange={(e) => setFile(e.target.files[0])}
          />
        </div>
      </section>

      {/* Patient Info */}
      <section className="bg-white rounded-xl shadow p-5 mb-5">
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
      <section className="bg-white rounded-xl shadow p-5 mb-5">
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
          <CHECKBOX label="Family history of breast cancer"    checked={form.family_history}           onChange={set('family_history')} />
          <CHECKBOX label="Personal history of breast cancer"  checked={form.personal_breast_cancer}   onChange={set('personal_breast_cancer')} />
          <CHECKBOX label="Hormone replacement therapy (HRT)"  checked={form.hormone_therapy}          onChange={set('hormone_therapy')} />
          <CHECKBOX label="Breast implants"                    checked={form.breast_implants}          onChange={set('breast_implants')} />
          <CHECKBOX label="Previous breast surgery"            checked={form.previous_surgery}         onChange={set('previous_surgery')} />
          <CHECKBOX label="Previous biopsy"                    checked={form.previous_biopsy}          onChange={set('previous_biopsy')} />
        </div>
        <div className="mt-4 border-t pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Clinical Presentation</p>
          <div className="grid grid-cols-3 gap-3">
            <CHECKBOX label="Reported lump"             checked={form.reported_lump}             onChange={set('reported_lump')} />
            <CHECKBOX label="Reported pain"             checked={form.reported_pain}             onChange={set('reported_pain')} />
            <CHECKBOX label="Nipple discharge"          checked={form.reported_nipple_discharge} onChange={set('reported_nipple_discharge')} />
          </div>
        </div>
      </section>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          {error}
        </div>
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
