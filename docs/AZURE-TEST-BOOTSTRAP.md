# Azure TEST Bootstrap

This package prepares the first Odiscom Supply Azure TEST deployment while deliberately stopping at **what-if**.

## Script

`scripts/microsoft/bootstrap-azure-test.ps1`

The script validates:

- authenticated tenant ID;
- Odiscom Supply LLC organization display name;
- `odiscomsupply.com` is verified;
- supplied Azure subscription belongs to the same Odiscom Supply tenant;
- resource-group name is TEST-scoped.

It then:

1. creates/ensures `rg-odiscom-supply-test`;
2. runs Bicep what-if against `infra/main.bicep`;
3. stops without deploying the Bicep template.

## Why it stops before deployment

The first live deployment should not happen until the what-if output is reviewed.

This protects against:
- wrong subscription;
- wrong tenant;
- wrong region;
- unexpected paid resources;
- accidental Odiscom LLC resource use;
- destructive changes.

## Inputs required

- Odiscom Supply tenant ID
- Odiscom Supply Azure subscription ID
- SQL Entra admin group display name
- SQL Entra admin group object ID
- temporary secure SQL bootstrap password

The bootstrap password is required only because Azure SQL logical-server creation requires an initial administrator credential. The Bicep template subsequently enables Entra-only authentication.

Do not store the password in:
- the repository;
- markdown;
- screenshots;
- chat;
- Bicep parameter files.

## Default region

The script defaults TEST to `southcentralus`.

Before PROD, region choice must be explicitly reviewed for:
- service availability;
- resilience;
- latency;
- compliance;
- cost.

## Production rule

This script is TEST-only.

Production deployment must use:
- a separate production resource group;
- explicit approval;
- validated TEST results;
- rollback plan;
- production-specific budget/monitoring.
