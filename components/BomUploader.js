import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { materialUploadSizeError } from '../lib/materialUpload'

const emptyForm = {
  company: '',
  contactName: '',
  customerEmail: '',
  phone: '',
  fileName: '',
  fileUrl: '',
  storagePath: '',
  notes: '',
}

function safeFileName(name) {
  return String(name || 'material-list')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function BomUploader() {
  const [form, setForm] = useState(emptyForm)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const fileInputRef = useRef(null)

  function updateField(field, value) {
    setForm({ ...form, [field]: value })
  }

  function handleFileChange(e) {
    const selectedFile = e.target.files?.[0]
    setFile(selectedFile || null)
    if (selectedFile && !form.fileName) updateField('fileName', selectedFile.name)
  }

  async function uploadFileIfNeeded() {
    if (!file) return { fileUrl: form.fileUrl, storagePath: form.storagePath, fileName: form.fileName }

    const sizeError = materialUploadSizeError(file.size)
    if (sizeError) throw new Error(sizeError)
    const signResponse = await fetch('/api/material-upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, fileSize: Number.isFinite(file.size) ? file.size : null, company: form.company }),
    })
    const signed = await signResponse.json()
    if (!signed.success) throw new Error(signed.message || 'Could not prepare secure upload.')

    const { error } = await supabase.storage.from('material-uploads').uploadToSignedUrl(signed.path, signed.token, file, {
      cacheControl: '3600',
      contentType: file.type || 'application/octet-stream',
    })

    if (error) throw new Error(error.message)

    return {
      fileUrl: form.fileUrl,
      storagePath: signed.path,
      fileName: file.name || form.fileName,
    }
  }

  async function submitUpload(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const uploaded = await uploadFileIfNeeded()

      const payload = {
        ...form,
        fileName: uploaded.fileName || form.fileName,
        fileUrl: uploaded.fileUrl || form.fileUrl,
        storagePath: uploaded.storagePath || form.storagePath,
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      setLoading(false)

      if (!data.success) {
        setMessage(data.message || 'Upload request failed.')
        return
      }

      setForm(emptyForm)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setMessage(data.notificationStatus === 'sent'
        ? `Material upload request ${data.requestId} received. A confirmation email was sent.`
        : `Material upload request ${data.requestId} was saved, but the confirmation email could not be sent. Please contact sales@odiscom.com and reference this request ID.`)
    } catch (err) {
      setLoading(false)
      setMessage(err.message || 'File upload failed. You can paste a shared file link instead.')
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="mb-6">
        <div className="mb-3 inline-flex rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Secure BOM Intake</div>
        <h2 className="text-2xl font-bold text-slate-950">Project Material Upload</h2>
        <p className="mt-2 text-slate-600">
          Upload a BOM, spreadsheet, PDF, plan sheet, or material list. You can also paste a shared file link if the file is already stored elsewhere.
        </p>
      </div>

      {message && <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{message}</div>}

      <form onSubmit={submitUpload} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <input required value={form.company} onChange={(e) => updateField('company', e.target.value)} placeholder="Company" className="rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-500" />
          <input value={form.contactName} onChange={(e) => updateField('contactName', e.target.value)} placeholder="Contact name" className="rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-500" />
          <input required type="email" value={form.customerEmail} onChange={(e) => updateField('customerEmail', e.target.value)} placeholder="Email" className="rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-500" />
          <input value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="Phone" className="rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-500" />
        </div>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">Upload file</label>
              <input ref={fileInputRef} type="file" onChange={handleFileChange} accept=".xlsx,.xls,.csv,.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.zip" className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" />
              {file && <p className="mt-2 text-xs text-slate-500">Selected: {file.name}</p>}
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">Or paste shared file link</label>
              <input value={form.fileUrl} onChange={(e) => updateField('fileUrl', e.target.value)} placeholder="Google Drive, Dropbox, OneDrive, etc." className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none focus:border-blue-500" />
            </div>
          </div>
          <input required value={form.fileName} onChange={(e) => updateField('fileName', e.target.value)} placeholder="File name, e.g. Project-BOM.xlsx" className="mt-4 w-full rounded-xl border border-slate-300 bg-white p-3 outline-none focus:border-blue-500" />
        </div>

        <textarea required value={form.notes} onChange={(e) => updateField('notes', e.target.value)} rows="7" placeholder="Describe the project, needed materials, brands, quantities, deadlines, delivery location, and alternates you want quoted." className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-500" />

        <button disabled={loading} className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {loading ? 'Submitting...' : 'Submit Material Upload Request'}
        </button>
      </form>

      <div className="mt-6 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
        <div className="rounded-2xl border bg-slate-50 p-4"><strong>Accepted:</strong> XLSX, CSV, PDF, Word, ZIP, plan images, and shared links (20 MB max).</div>
        <div className="rounded-2xl border bg-slate-50 p-4"><strong>Use cases:</strong> Fiber BOMs, wireless builds, splice kits, tools, reels, and trailers.</div>
        <div className="rounded-2xl border bg-slate-50 p-4"><strong>Next step:</strong> Odiscom Supply reviews your list and prepares pricing.</div>
      </div>
    </div>
  )
}
