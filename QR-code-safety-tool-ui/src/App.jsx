import { useState } from 'react'
import UploadZone from './components/UploadZone'
import ResultCard from './components/ResultCard'
import LoadingSpinner from './components/LoadingSpinner'
import './App.css'

const MOCK_RESULT = {
  url: 'http://192.168.1.1/login?token=abc123',
  score: 60,
  verdict: 'dangerous',
  reasons: [
    'IP address used instead of a domain name',
    'Contains suspicious keyword: login',
    'No HTTPS — connection is unencrypted',
  ],
}

export default function App() {
  const [state, setState] = useState('idle')   // idle | loading | result | error
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(file) {
    setState('loading')
    setErrorMsg('')

    try {
      const body = new FormData()
      body.append('image', file)

      const res = await fetch('/api/analyze-qr', { method: 'POST', body })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error ?? 'Analysis failed')

      setResult(data)
      setState('result')
    } catch (err) {
      // backend not ready yet — use mock so UI is testable
      if (import.meta.env.DEV && err.message.includes('fetch')) {
        setResult(MOCK_RESULT)
        setState('result')
        return
      }
      setErrorMsg(err.message)
      setState('error')
    }
  }

  function handleReset() {
    setState('idle')
    setResult(null)
    setErrorMsg('')
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="logo-mark">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none"/>
            <rect x="16" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none"/>
            <rect x="2" y="16" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none"/>
            <rect x="5" y="5" width="4" height="4" rx="0.5" fill="currentColor"/>
            <rect x="19" y="5" width="4" height="4" rx="0.5" fill="currentColor"/>
            <rect x="5" y="19" width="4" height="4" rx="0.5" fill="currentColor"/>
            <path d="M19 16h2m2 0h2m-2 2v2m0-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M16 22h4m2 0h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M22 24v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <h1 className="app-title">QR Safety Check</h1>
          <p className="app-subtitle">Decode and analyze any QR code for threats before you visit the link</p>
        </div>
      </header>

      <main className="app-main">
        {state === 'idle' && (
          <UploadZone onSubmit={handleSubmit} disabled={false} />
        )}
        {state === 'loading' && <LoadingSpinner />}
        {state === 'result' && (
          <ResultCard result={result} onReset={handleReset} />
        )}
        {state === 'error' && (
          <div className="error-box">
            <p className="error-msg">{errorMsg}</p>
            <button className="reset-btn" onClick={handleReset}>Try again</button>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>Results are indicative, not guaranteed. Always verify suspicious links independently.</p>
      </footer>
    </div>
  )
}
