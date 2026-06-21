import { useRef, useState } from 'react'

export default function UploadZone({ onSubmit, disabled }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState(null)
  const [file, setFile] = useState(null)

  function handleFile(f) {
    if (!f || !f.type.startsWith('image/')) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  function handleChange(e) {
    handleFile(e.target.files[0])
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!file) return
    onSubmit(file)
  }

  function handleReset() {
    setFile(null)
    setPreview(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <div
        className={`upload-zone ${dragging ? 'dragging' : ''} ${preview ? 'has-preview' : ''}`}
        onClick={() => !preview && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleChange}
          style={{ display: 'none' }}
        />

        {preview ? (
          <div className="preview-wrapper">
            <img src={preview} alt="QR code preview" className="preview-img" />
            <button
              type="button"
              className="remove-btn"
              onClick={(e) => { e.stopPropagation(); handleReset() }}
              aria-label="Remove image"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="upload-placeholder">
            <svg className="upload-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2.5" fill="none"/>
              <rect x="28" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2.5" fill="none"/>
              <rect x="4" y="28" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2.5" fill="none"/>
              <rect x="8" y="8" width="8" height="8" rx="1" fill="currentColor"/>
              <rect x="32" y="8" width="8" height="8" rx="1" fill="currentColor"/>
              <rect x="8" y="32" width="8" height="8" rx="1" fill="currentColor"/>
              <path d="M32 28h4m0 0h4m-4 0v4m0-4v-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M28 36h8m4 0h4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M36 40v4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <p className="upload-title">Drop a QR code image here</p>
            <p className="upload-sub">or</p>
            <button
              type="button"
              className="camera-btn"
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              Add Photo
            </button>
          </div>
        )}
      </div>

      <button
        type="submit"
        className="analyze-btn"
        disabled={!file || disabled}
      >
        Analyze QR Code
      </button>
    </form>
  )
}
