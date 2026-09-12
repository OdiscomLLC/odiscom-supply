import { createSupabaseAdmin } from '../../lib/supabaseAdmin'
import { ALLOWED_MATERIAL_UPLOAD_EXTENSIONS, materialUploadExtension, materialUploadSizeError } from '../../lib/materialUpload'

function safeFileName(name) {
  return String(name || 'material-list').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' })
  const { fileName, fileSize, company } = req.body || {}
  const extension = materialUploadExtension(fileName)
  if (!fileName || !company || !ALLOWED_MATERIAL_UPLOAD_EXTENSIONS.has(extension)) return res.status(400).json({ success: false, message: 'Unsupported file type.' })
  const sizeError = materialUploadSizeError(fileSize)
  if (sizeError) return res.status(400).json({ success: false, message: sizeError })

  try {
    const path = `${Date.now()}-${safeFileName(company)}-${safeFileName(fileName)}`
    const admin = createSupabaseAdmin()
    const { data, error } = await admin.storage.from('material-uploads').createSignedUploadUrl(path)
    if (error) throw error
    return res.status(200).json({ success: true, path, token: data.token })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}
