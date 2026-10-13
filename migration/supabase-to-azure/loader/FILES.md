# Supabase File → Azure Blob TEST Migrator

This script migrates file-like records from the immutable Supabase snapshot into the Odiscom Supply Azure Blob TEST container.

It supports:

- legacy `data:` URLs;
- absolute HTTP/HTTPS source URLs;
- Supabase Storage references in `bucket/path` form.

It intentionally reports unresolved source references rather than fabricating a file.

## Current source reality

The 2026-10-13 source audit shows:

- one material-upload record backed by an inline CSV `data:` URL;
- zero customer-document rows;
- one supplier-import job whose historical XLSX filename is retained but whose `storage_path` is null.

Therefore the historical ACE XLSX binary is **not currently represented by a retrievable Supabase storage reference**. Its normalized 470-row import data remains preserved in the database migration, but the original workbook must be recovered separately if we want the binary in the Microsoft archive.

## Required environment

```text
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-side only>
AZURE_STORAGE_ACCOUNT_URL=https://<account>.blob.core.windows.net
AZURE_STORAGE_CONTAINER=application-uploads
ODISCOM_SUPPLY_ENVIRONMENT=test
```

The Azure identity comes from `DefaultAzureCredential`.

## Safety

The script:

- is TEST-only;
- never writes to Supabase;
- never logs the service-role key;
- refuses to create a missing Azure container;
- uploads with `If-None-Match: *` so it will not silently overwrite an existing target blob;
- downloads the uploaded blob and verifies both byte length and SHA-256;
- writes a local reconciliation report.

## Run

From `migration/supabase-to-azure/loader` after `npm install`:

```bash
node migrate-files-to-blob.mjs ../snapshots/<snapshot>
```

The generated `file-migration-report.json` is ignored with the snapshot directory and should not be committed.

## Follow-up

A later step will import successful rows from the report into `migration.FileReconciliation` for the corresponding migration run.
