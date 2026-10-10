# Microsoft Foundation Provisioning Gate

This checklist is the execution gate between repository scaffolding and live Odiscom Supply Microsoft provisioning.

## Gate A — tenant/domain

Required before identity provisioning:

- Tenant display name: Odiscom Supply LLC
- Initial tenant domain: `odiscomsupply.onmicrosoft.com`
- Custom domain added: `odiscomsupply.com`
- Custom domain status: Verified
- Global administrator is a named person, not a shared mailbox
- At least one recovery/break-glass administrator exists before reducing bootstrap access

Do not use `sales@odiscomsupply.com` as a tenant administrator.

## Gate B — internal identity

Run only after Gate A:

1. `bootstrap-entra-internal.ps1`
2. verify the Odiscom Supply-only groups exist;
3. verify the internal API app/service principal exists;
4. `configure-entra-app-roles.ps1`
5. verify group-to-app-role assignments;
6. verify no Odiscom LLC group or app was changed.

The scripts intentionally refuse to run if the authenticated tenant ID does not match the supplied Odiscom Supply tenant and the custom domain is not verified.

## Gate C — Azure ownership

Before infrastructure deployment:

- Azure subscription is explicitly approved for Odiscom Supply use;
- Odiscom Supply resource group created;
- Azure DevOps service connection uses workload identity federation;
- SQL Entra administrator group belongs to Odiscom Supply;
- deployment secrets live in Azure DevOps secret variables / Key Vault;
- no Odiscom AI resource group or Key Vault is reused.

## Gate D — test deployment

Deploy `infra/main.bicep` to a non-production Odiscom Supply resource group.

Validate:

- Key Vault
- Storage
- Azure SQL
- Function App
- App Service
- Application Insights
- managed identities
- RBAC role assignments
- TLS/HTTPS configuration

Do not point `odiscomsupply.com` production DNS to Azure during this gate.

## Gate E — database schema

Apply in order:

1. `database/azure-sql/001_core_schema.sql`
2. `database/azure-sql/002_material_upload.sql`
3. `database/azure-sql/003_migration_control.sql`

Then run the target audit.

## Gate F — supplier connector rehearsal

Load DigiKey and Mouser secrets into Odiscom Supply Key Vault.

Validate with exact manufacturer + MPN test cases.

A successful API response must not auto-publish a new canonical product unless the configured review policy explicitly allows it.

Do not claim DigiKey/Mouser production activation solely because the Azure adapter works.

## Gate G — migration rehearsal

1. run source audit;
2. create a `migration.MigrationRun` row with `RunType='rehearsal'`;
3. build persistent source-to-target mapping;
4. migrate manufacturers/products;
5. migrate suppliers/offers/import history;
6. build customer master from transactions and customer table;
7. migrate quotes/orders/events/uploads/opportunities;
8. migrate file binaries;
9. run target audit;
10. compare reconciliation metrics.

Expected special case:

- Odiscom LLC must materialize as a normal customer organization even if the legacy `customers` table remains empty.
- Set `IsRelatedCompany = 1`.
- Do not grant internal Odiscom Supply permissions from that flag.

## Gate H — SharePoint internal workspace

After the Odiscom Supply SharePoint tenant/site exists:

- create Odiscom Supply Operations site;
- apply internal group access;
- create governed document libraries;
- grant app-only access with `Sites.Selected` when needed;
- verify the app cannot reach an Odiscom LLC site;
- deploy SPFx only after API auth is validated.

## Gate I — external identity

Configure Entra External ID separately for:

- customers;
- suppliers.

Validate organization membership isolation before migration of external authentication.

## Gate J — production cutover

Cutover requires explicit approval after successful dual-run.

Before switching:

- final source audit passes;
- rollback tested;
- Azure monitoring healthy;
- customer login tested;
- supplier login tested;
- internal login tested;
- quote/order workflow tested;
- supplier connector tested;
- files reconciled;
- no source relationship is orphaned.

Only then:

- switch application traffic;
- stop legacy writes;
- observe;
- retain rollback/archive period;
- retire Vercel/Supabase/GitHub production dependencies after acceptance.

## Hard boundary

Nothing in this gate authorizes changes to:

- Odiscom LLC;
- Odiscom AI;
- `os.odiscom.com`;
- Odiscom LLC Entra groups/apps;
- Odiscom LLC SharePoint;
- Odiscom LLC Azure resources.
