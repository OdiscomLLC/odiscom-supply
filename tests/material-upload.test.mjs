import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ALLOWED_MATERIAL_UPLOAD_EXTENSIONS,
  MAX_MATERIAL_UPLOAD_BYTES,
  materialUploadExtension,
  materialUploadSizeError,
} from '../lib/materialUpload.js'

test('small and boundary-size material uploads are accepted', () => {
  assert.equal(materialUploadSizeError(0), null)
  assert.equal(materialUploadSizeError(null), null)
  assert.equal(materialUploadSizeError(undefined), null)
  assert.equal(materialUploadSizeError(300), null)
  assert.equal(materialUploadSizeError(4_249), null)
  assert.equal(materialUploadSizeError(MAX_MATERIAL_UPLOAD_BYTES), null)
})

test('oversize and invalid material uploads are rejected accurately', () => {
  assert.equal(materialUploadSizeError(MAX_MATERIAL_UPLOAD_BYTES + 1), 'Files must be 20 MB or smaller.')
  assert.match(materialUploadSizeError(-1), /could not read/i)
  assert.match(materialUploadSizeError('not-a-size'), /could not read/i)
})

test('material upload extensions match the public form', () => {
  for (const extension of ['xlsx', 'xls', 'csv', 'pdf', 'doc', 'docx', 'txt', 'png', 'jpg', 'jpeg', 'zip']) {
    assert.equal(ALLOWED_MATERIAL_UPLOAD_EXTENSIONS.has(extension), true)
  }
  assert.equal(materialUploadExtension('PROJECT-BOM.XLSX'), 'xlsx')
})
