# Azure DevOps Repository Migration

The long-term Odiscom Supply source-control target is Azure DevOps Repos + Azure Pipelines.

GitHub remains a migration source until the Azure DevOps repository and pipelines are proven.

## Target structure

Recommended Azure DevOps organization/project:

- Organization: Odiscom Supply-owned Azure DevOps organization
- Project: **Odiscom Supply**
- Repository: **odiscom-supply**

The exact organization URL must be approved after the Odiscom Supply Microsoft/Azure environment is established.

## Migration method

Use a **mirror clone/push** so branches, tags, and refs are preserved.

Script:

`scripts/microsoft/migrate-github-to-azure-devops.ps1`

Required inputs:

- Azure DevOps organization URL
- Azure DevOps project name
- repository name

The script creates the destination repository if needed, clones the current GitHub repo as a mirror, and pushes all refs to Azure DevOps.

## Authentication

Do not commit credentials.

Preferred:
- Microsoft/Entra authenticated Azure CLI for Azure DevOps access where supported;
- workload identity federation for pipelines;
- if a temporary PAT is unavoidable for bootstrap, store it only in the local secure credential/session and revoke it after migration.

Do not put PATs in source code, markdown, Bicep, pipeline YAML, or chat.

## Pipeline target

Use the existing root `azure-pipelines.yml` as the starting pipeline.

Pipeline goals:

1. validate Bicep;
2. validate Azure Functions package;
3. run connector/unit tests;
4. run infrastructure what-if;
5. deploy TEST only after validation;
6. add approvals before PROD;
7. retain rollback artifacts.

## Migration verification

Before declaring Azure DevOps canonical:

- default branch exists;
- all important release/migration branches are present;
- tags are present;
- latest main commit SHA matches the GitHub source;
- pipeline reads the correct repo;
- Bicep validation passes;
- Azure Function tests pass;
- TEST deployment succeeds;
- pull-request policies are configured;
- branch protection is configured;
- service connection is Odiscom Supply-owned.

## GitHub retirement

Do **not** delete or archive GitHub immediately.

Retirement gate:

1. Azure DevOps mirror verified;
2. new work lands in Azure DevOps;
3. CI/CD runs from Azure DevOps;
4. deployment rollback proven;
5. no Vercel/GitHub Action production dependency remains;
6. migration history retained.

Then GitHub may be archived read-only.

## Company boundary

The Odiscom Supply Azure DevOps organization/project must not be placed inside an Odiscom LLC engineering project by default.

Odiscom AI repositories remain separate.

No changes to `os.odiscom.com` are part of this migration.
