# Azure SQL TEST Rehearsal Loader

This loader is the target-side half of the deterministic Supabase → Azure SQL rehearsal.

It is intentionally **TEST-only** and refuses non-empty business tables.

## Packages

Pinned versions:

- `@azure/identity` 4.13.3
- `mssql` 12.7.2

The loader uses Microsoft Entra passwordless authentication through `DefaultAzureCredential` and obtains an Azure SQL token for `https://database.windows.net/.default`.

## Install

From this directory:

```bash
npm install
```

Do not commit credentials.

## Required environment

```text
SQL_SERVER_FQDN=<server>.database.windows.net
SQL_DATABASE_NAME=OdiscomSupply
ODISCOM_SUPPLY_ENVIRONMENT=test
```

Authentication comes from the current Azure CLI/developer identity locally or managed/workload identity in Azure DevOps.

The identity must have database permissions granted through the Odiscom Supply Entra/SQL administration model.

## Run

First produce an immutable source snapshot and Azure-shaped transform.

Then:

```bash
node load-azure-test.mjs ../snapshots/<snapshot>/azure-shaped
```

## Safety behavior

The loader:

1. requires `ODISCOM_SUPPLY_ENVIRONMENT=test`;
2. obtains an Entra access token instead of accepting a SQL password;
3. checks every target domain/migration table and refuses to load if any is non-empty;
4. creates a `migration.MigrationRun` audit record;
5. loads all transformed data in one SQL transaction;
6. records a reconciliation metric for every loaded table;
7. rolls back the data transaction on any mismatch/error;
8. marks the migration run passed or failed.

## Why a fresh TEST database

Rehearsals should be deterministic.

This first loader deliberately does not attempt to merge into an existing target database. Incremental/cutover loaders will be added only after the fresh-load rehearsal passes.

## Source-field archive

Fields without a direct normalized Azure SQL target are inserted into `migration.SourceFieldArchive` and linked to the rehearsal run.

This is how we preserve legacy information without contaminating the normalized production schema.

## Source-record map

`migration.SourceRecordMap` supports many source records mapping to one normalized target.

Example:

- Odiscom LLC quote record → Odiscom LLC customer
- Odiscom LLC order record → same Odiscom LLC customer
- material upload → same Odiscom LLC customer

The target-side mapping index is intentionally non-unique.

## Not included yet

This loader does not:

- move binary files;
- create Entra External ID users;
- update DNS;
- cut production traffic;
- stop Supabase writes;
- retire Vercel/GitHub.

Those remain separate cutover gates.
