import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCases, triggerEtlImport } from '../services/api';

// ── Config ────────────────────────────────────────────────────────────────────

const URGENCY = {
  urgent:     { border: 'border-l-red-500',   badge: 'bg-red-50 text-red-600 border border-red-200',       dot: 'bg-red-500',   label: 'Urgent'     },
  concerning: { border: 'border-l-amber-500', badge: 'bg-amber-50 text-amber-600 border border-amber-200', dot: 'bg-amber-500', label: 'Concerning' },
  routine:    { border: 'border-l-green-500', badge: 'bg-green-50 text-green-600 border border-green-200', dot: 'bg-green-500', label: 'Routine'    },
};

const RISK_BADGE = {
  high:         'bg-red-50 text-red-600 border border-red-200',
  intermediate: 'bg-amber-50 text-amber-600 border border-amber-200',
  low:          'bg-green-50 text-green-600 border border-green-200',
};

const SERIES = {
  tomosynthesis: { label: 'Tomo 3D',  color: 'text-violet-400' },
  transpara:     { label: 'Transpara', color: 'text-blue-400'  },
  '2d':          { label: '2D FFDM',  color: 'text-gray-400'  },
};

const BIRADS_COLOR = {
  0: '#6b7280', 1: '#22c55e', 2: '#16a34a',
  3: '#eab308', 4: '#f97316', 5: '#dc2626', 6: '#7f1d1d',
};

const BIRADS_LABEL = {
  0: 'Incomplete', 1: 'Negative', 2: 'Benign',
  3: 'Prob. Benign', 4: 'Suspicious', 5: 'Hi. Suspicious', 6: 'Known Malig.',
};

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-1 shadow-sm">
      <div className={`w-1.5 h-1.5 rounded-full mb-1 ${accent}`} />
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs font-semibold text-gray-700">{label}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}

// ── Donut ─────────────────────────────────────────────────────────────────────

function Donut({ segments, size = 80, thickness = 12 }) {
  const r    = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const cx   = size / 2;
  const cy   = size / 2;
  const total = segments.reduce((s, d) => s + d.value, 0);
  let offset  = circ * 0.25;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      {total === 0 ? (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={thickness} />
      ) : (
        segments.map((seg, i) => {
          const dash = (seg.value / total) * circ;
          const gap  = circ - dash;
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={seg.color} strokeWidth={thickness}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset + circ}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return el;
        })
      )}
    </svg>
  );
}

// ── Analytics ─────────────────────────────────────────────────────────────────

function Analytics({ cases }) {
  const total = cases.length;

  const biradsRows = [1,2,3,4,5,6].map(n => ({
    label: `${n}`, fullLabel: BIRADS_LABEL[n],
    count: cases.filter(c => c.overall_birads === n).length,
    color: BIRADS_COLOR[n],
  }));
  const maxBirads = Math.max(...biradsRows.map(r => r.count), 1);

  const riskSegs = [
    { name: 'High',   value: cases.filter(c => c.patient_risk_category === 'high').length,         color: '#ef4444' },
    { name: 'Medium', value: cases.filter(c => c.patient_risk_category === 'intermediate').length, color: '#f59e0b' },
    { name: 'Low',    value: cases.filter(c => c.patient_risk_category === 'low').length,          color: '#22c55e' },
  ];

  const reviewed = cases.filter(c => c.signed_off).length;
  const pending  = total - reviewed;
  const pct      = total > 0 ? Math.round((reviewed / total) * 100) : 0;
  const reviewSegs = [
    { name: 'Reviewed', value: reviewed, color: '#3b82f6' },
    { name: 'Pending',  value: pending,  color: '#1f2937' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

      {/* BI-RADS */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">BI-RADS Distribution</p>
        <div className="space-y-2.5">
          {biradsRows.map(({ label, fullLabel, count, color }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-[10px] text-gray-400 w-4 text-right font-mono flex-shrink-0">{label}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(count / maxBirads) * 100}%`, background: color }} />
              </div>
              <span className="text-[10px] text-gray-400 w-24 flex-shrink-0">{fullLabel}</span>
              <span className="text-xs font-semibold text-gray-700 w-4 text-right">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Risk */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Patient Risk Profile</p>
        <div className="flex items-center gap-5">
          <Donut segments={riskSegs} />
          <div className="space-y-2.5 flex-1">
            {riskSegs.map(d => (
              <div key={d.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  {d.name} Risk
                </span>
                <span className="text-sm font-bold text-gray-800">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Review Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Review Completion</p>
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            <Donut segments={reviewSegs} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-gray-700">{pct}%</span>
            </div>
          </div>
          <div className="space-y-2.5 flex-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Reviewed</span>
              <span className="font-bold text-gray-800">{reviewed}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Pending</span>
              <span className="font-bold text-gray-800">{pending}</span>
            </div>
            <div className="flex justify-between text-xs pt-1 border-t border-gray-100">
              <span className="text-gray-500">Total Cases</span>
              <span className="font-bold text-gray-800">{total}</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [cases,        setCases]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [importing,    setImporting]    = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [filter,       setFilter]       = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search,       setSearch]       = useState('');
  const navigate = useNavigate();

  const fetchCases = useCallback(() => {
    setLoading(true);
    getCases()
      .then(r => setCases(r.data.cases || []))
      .catch(() => setError('Could not load cases. Is the backend running?'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const handleImport = async () => {
    setImporting(true); setImportResult(null);
    try {
      const res = await triggerEtlImport();
      setImportResult(res.data);
      fetchCases();
    } catch (err) {
      setImportResult({ success: false, error: String(err.response?.data?.detail || err.message) });
    } finally {
      setImporting(false);
    }
  };

  const urgent     = cases.filter(c => c.overall_case_urgency === 'urgent').length;
  const concerning = cases.filter(c => c.overall_case_urgency === 'concerning').length;
  const highRisk   = cases.filter(c => c.patient_risk_category === 'high').length;
  const pending    = cases.filter(c => !c.signed_off).length;

  const displayed = cases
    .filter(c => filter === 'all' || c.overall_case_urgency === filter)
    .filter(c => statusFilter === 'all' || (statusFilter === 'signed_off' ? c.signed_off : !c.signed_off))
    .filter(c => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (c.patient_id || '').toLowerCase().includes(q)
          || (c.patient_name || '').toLowerCase().includes(q);
    });

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 gap-3">
      <span className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
      Loading worklist…
    </div>
  );
  if (error) return <p className="p-8 text-red-500">{error}</p>;

  return (
    <div className="p-6 space-y-6 min-h-full">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Case Worklist</h1>
          <p className="text-xs text-gray-400 mt-0.5">{cases.length} cases · sorted by urgency</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleImport}
            disabled={importing}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-600 hover:text-gray-900 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 shadow-sm"
          >
            {importing
              ? <><span className="animate-spin w-3.5 h-3.5 border-2 border-gray-500 border-t-transparent rounded-full" /> Importing…</>
              : <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg> Import Cases</>}
          </button>
          <button
            onClick={() => navigate('/upload')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs font-medium transition-colors shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            New Case
          </button>
        </div>
      </div>

      {/* Import banner */}
      {importResult && (
        <div className={`rounded-lg px-4 py-3 text-xs border ${
          importResult.success
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {importResult.success
            ? `Import complete — ${importResult.imported} imported, ${importResult.skipped} skipped, ${importResult.errors} errors`
            : `Import failed: ${importResult.error}`}
        </div>
      )}

      {/* Stat cards */}
      {cases.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Urgent"      value={urgent}     sub="same-day action required" accent="bg-red-500" />
          <StatCard label="Concerning"  value={concerning} sub="biopsy recommended"        accent="bg-amber-500" />
          <StatCard label="High Risk"   value={highRisk}   sub="by Gail model"             accent="bg-orange-500" />
          <StatCard label="Pending Review" value={pending} sub="awaiting sign-off"         accent="bg-blue-500" />
        </div>
      )}

      {/* Analytics */}
      {cases.length > 0 && <Analytics cases={cases} />}

      {/* Filter bar */}
      {cases.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text" value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search patient…"
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-500 w-48 shadow-sm"
            />
          </div>

          <div className="w-px h-5 bg-gray-200" />

          {['all', 'urgent', 'concerning', 'routine'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:border-gray-400 shadow-sm'
              }`}
            >
              {f === 'all'
                ? `All (${cases.length})`
                : `${f.charAt(0).toUpperCase() + f.slice(1)} (${cases.filter(c => c.overall_case_urgency === f).length})`}
            </button>
          ))}

          <div className="w-px h-5 bg-gray-200" />

          {[
            { key: 'all',        label: 'Any Status' },
            { key: 'pending',    label: `Pending (${cases.filter(c => !c.signed_off).length})` },
            { key: 'signed_off', label: `Reviewed (${cases.filter(c => c.signed_off).length})` },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:border-gray-400 shadow-sm'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Worklist table */}
      {displayed.length === 0 ? (
        <div className="text-center py-24 text-gray-600">
          <svg className="w-10 h-10 mx-auto mb-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
          </svg>
          <p className="text-sm text-gray-500 mb-1">No cases match your filters</p>
          <p className="text-xs text-gray-600">Try changing the filter or uploading a new case</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">

          {/* Table header */}
          <div className="grid grid-cols-[3fr_1fr_1fr_1fr_1fr_1fr_1fr_80px] px-4 py-3 border-b border-gray-200 bg-gray-50">
            {['Patient', 'Age / Sex', 'Series', 'Slices', 'Quality', 'Risk', 'Urgency', ''].map(h => (
              <span key={h} className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</span>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-100">
            {displayed.map(c => {
              const urg    = URGENCY[c.overall_case_urgency] || URGENCY.routine;
              const series = SERIES[c.series_type] || SERIES['2d'];
              const qScore = c.quality_score != null ? Math.round(c.quality_score) : null;
              const qColor = qScore >= 80 ? 'bg-green-500' : qScore >= 60 ? 'bg-amber-500' : 'bg-red-500';

              return (
                <div
                  key={c.id}
                  onClick={() => navigate(`/analysis/${c.id}`)}
                  className={`grid grid-cols-[3fr_1fr_1fr_1fr_1fr_1fr_1fr_80px] px-4 py-3.5 border-l-2 ${urg.border} hover:bg-slate-50 cursor-pointer transition-colors items-center`}
                >
                  {/* Patient */}
                  <div>
                    <p className="text-sm font-semibold text-gray-900 leading-tight">{c.patient_name || '—'}</p>
                    <p className="text-[11px] text-gray-400 font-mono mt-0.5">{c.patient_id}</p>
                  </div>

                  {/* Age */}
                  <div className="text-xs text-gray-500">
                    {c.age ? <><span className="text-gray-700 font-medium">{c.age}</span>y / {c.sex}</> : '—'}
                  </div>

                  {/* Series */}
                  <div className={`text-xs font-semibold ${series.color}`}>{series.label}</div>

                  {/* Slices */}
                  <div className="text-xs text-gray-400">
                    {c.total_slices > 1 ? <><span className="text-gray-600 font-medium">{c.total_slices}</span> sl</> : '—'}
                  </div>

                  {/* Quality */}
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${qColor}`} style={{ width: `${qScore || 0}%` }} />
                    </div>
                    <span className="text-[11px] text-gray-400">{qScore != null ? `${qScore}%` : '—'}</span>
                  </div>

                  {/* Risk */}
                  <div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${RISK_BADGE[c.patient_risk_category] || 'bg-gray-100 text-gray-400'}`}>
                      {c.patient_risk_category || '—'}
                    </span>
                  </div>

                  {/* Urgency */}
                  <div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold ${urg.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${urg.dot}`} />
                      {urg.label}
                    </span>
                  </div>

                  {/* Action */}
                  <div className="text-right">
                    {c.signed_off ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-green-50 text-green-600 border border-green-200">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                        Done
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:text-blue-700">
                        Review
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
