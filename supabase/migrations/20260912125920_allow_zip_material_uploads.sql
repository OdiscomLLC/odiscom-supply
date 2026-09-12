update storage.buckets
set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = array[
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/png',
    'image/jpeg',
    'application/zip',
    'application/x-zip-compressed'
  ]::text[]
where id = 'material-uploads';
