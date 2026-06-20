export default function LoadingSpinner() {
  return (
    <div className="loading-wrapper">
      <div className="spinner" aria-label="Analyzing..." />
      <p className="loading-text">Analyzing QR code...</p>
    </div>
  )
}
