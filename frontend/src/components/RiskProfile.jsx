const CATEGORY_STYLE = {
  low:          'bg-green-100 text-green-700 border-green-300',
  intermediate: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  high:         'bg-red-100 text-red-700 border-red-300',
};

export default function RiskProfile({ caseData }) {
  if (!caseData) return null;

  const risk      = caseData.patient_risk_category || 'unknown';
  const riskPct   = caseData.age_adjusted_risk != null
    ? (caseData.age_adjusted_risk * 100).toFixed(1)
    : null;

  const flags = [
    caseData.family_history          && 'Family history (+)',
    caseData.personal_breast_cancer  && 'Personal cancer history (++)',
    caseData.brca_mutation === 'positive' && 'BRCA positive (++)',
    caseData.menopause_status === 'post'  && 'Post-menopausal',
    caseData.hormone_therapy         && 'On HRT',
    caseData.breast_implants         && 'Breast implants',
    caseData.previous_biopsy         && 'Previous biopsy',
    caseData.reported_lump           && 'Reported lump',
    caseData.reported_nipple_discharge && 'Nipple discharge',
  ].filter(Boolean);

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">
        Patient Risk Profile
      </h3>

      <div className="flex items-center gap-3 mb-4">
        <span className={`px-3 py-1 rounded-full border font-bold text-sm ${CATEGORY_STYLE[risk] || 'bg-gray-100 text-gray-600'}`}>
          {risk.toUpperCase()} RISK
        </span>
        {riskPct && (
          <span className="text-gray-500 text-sm">{riskPct}% estimated</span>
        )}
      </div>

      <div className="text-sm text-gray-600 space-y-1 mb-3">
        <p><span className="font-medium">Age:</span> {caseData.age}y ({caseData.sex})</p>
        <p><span className="font-medium">BRCA:</span> {caseData.brca_mutation || 'unknown'}</p>
        <p><span className="font-medium">Menopause:</span> {caseData.menopause_status || 'unknown'}</p>
      </div>

      {flags.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Active Risk Factors</p>
          <ul className="space-y-0.5">
            {flags.map((f, i) => (
              <li key={i} className="flex items-center gap-1.5 text-xs text-yellow-800">
                <span className="text-yellow-500">⚠</span>{f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
