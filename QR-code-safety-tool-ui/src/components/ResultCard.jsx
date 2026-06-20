const VERDICT_META = {
  safe:       { label: 'Safe',       color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   ring: '#22c55e' },
  suspicious: { label: 'Suspicious', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  ring: '#f59e0b' },
  dangerous:  { label: 'Dangerous',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   ring: '#ef4444' },
}

function ScoreRing({ score, verdict }) {
  const meta = VERDICT_META[verdict] ?? VERDICT_META.safe
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="score-ring-wrapper">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={radius} fill="none" stroke="var(--border)" strokeWidth="10" />
        <circle
          cx="55" cy="55" r={radius}
          fill="none"
          stroke={meta.ring}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 55 55)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="score-label">
        <span className="score-number" style={{ color: meta.color }}>{score}</span>
        <span className="score-unit">/100</span>
      </div>
    </div>
  )
}

export default function ResultCard({ result, onReset }) {
  const { url, score, verdict, reasons } = result
  const meta = VERDICT_META[verdict] ?? VERDICT_META.safe

  return (
    <div className="result-card">
      <div className="result-header" style={{ borderColor: meta.color }}>
        <ScoreRing score={score} verdict={verdict} />
        <div className="result-summary">
          <span className="verdict-badge" style={{ color: meta.color, background: meta.bg }}>
            {verdict === 'safe' && '✓ '}
            {verdict === 'suspicious' && '⚠ '}
            {verdict === 'dangerous' && '✕ '}
            {meta.label}
          </span>
          <p className="result-url" title={url}>{url}</p>
        </div>
      </div>

      {reasons.length > 0 && (
        <div className="result-reasons">
          <h3 className="reasons-title">Why this score?</h3>
          <ul className="reasons-list">
            {reasons.map((r, i) => (
              <li key={i} className="reason-item">{r}</li>
            ))}
          </ul>
        </div>
      )}

      <button className="reset-btn" onClick={onReset}>
        Scan another QR code
      </button>
    </div>
  )
}
