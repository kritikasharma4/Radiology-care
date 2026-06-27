import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCases } from '../services/api';

const URGENCY_STYLE = {
  urgent:     'bg-red-100 text-red-700 border border-red-300',
  concerning: 'bg-yellow-100 text-yellow-700 border border-yellow-300',
  routine:    'bg-green-100 text-green-700 border border-green-300',
};

export default function Dashboard() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    getCases()
      .then((r) => setCases(r.data.cases || []))
      .catch(() => setError('Could not load cases. Is the backend running?'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-8 text-gray-500">Loading cases…</p>;
  if (error)   return <p className="p-8 text-red-500">{error}</p>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Case Worklist</h1>
        <button
          onClick={() => navigate('/upload')}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium"
        >
          + New Case
        </button>
      </div>

      {cases.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-4">📋</p>
          <p className="text-lg">No cases yet. Upload a DICOM to get started.</p>
          <button
            onClick={() => navigate('/upload')}
            className="mt-4 bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700"
          >
            Upload First Case
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Patient</th>
                <th className="px-4 py-3 text-left">Age / Sex</th>
                <th className="px-4 py-3 text-left">Study Date</th>
                <th className="px-4 py-3 text-left">Risk</th>
                <th className="px-4 py-3 text-left">Quality</th>
                <th className="px-4 py-3 text-left">Urgency</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cases.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{c.patient_name || '—'}</p>
                    <p className="text-gray-400 text-xs">{c.patient_id}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.age}y / {c.sex}</td>
                  <td className="px-4 py-3 text-gray-600">{c.study_date || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      c.patient_risk_category === 'high'         ? 'bg-red-100 text-red-700' :
                      c.patient_risk_category === 'intermediate' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {c.patient_risk_category || 'unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.quality_score != null ? `${Math.round(c.quality_score)}%` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${URGENCY_STYLE[c.overall_case_urgency] || 'bg-gray-100 text-gray-600'}`}>
                      {c.overall_case_urgency || 'pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/analysis/${c.id}`)}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      View →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
