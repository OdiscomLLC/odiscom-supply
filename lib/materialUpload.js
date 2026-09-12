export const MAX_MATERIAL_UPLOAD_BYTES = 20 * 1024 * 1024

export const ALLOWED_MATERIAL_UPLOAD_EXTENSIONS = new Set([
  'xlsx',
  'xls',
  'csv',
  'pdf',
  'doc',
  'docx',
  'txt',
  'png',
  'jpg',
  'jpeg',
  'zip',
])

export function materialUploadSizeError(fileSize) {
  // The private Storage bucket enforces the same 20 MB ceiling. Missing or
  // zero metadata must not make a valid browser-selected file look oversized.
  if (fileSize === null || fileSize === undefined || fileSize === '') return null

  const size = Number(fileSize)
  if (!Number.isFinite(size) || size < 0) return 'Could not read the selected file size. Please choose the file again.'
  if (size > MAX_MATERIAL_UPLOAD_BYTES) return 'Files must be 20 MB or smaller.'
  return null
}

export function materialUploadExtension(fileName) {
  return String(fileName || '').split('.').pop().toLowerCase()
}
