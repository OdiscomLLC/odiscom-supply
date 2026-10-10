# First Live Microsoft Runbook — Odiscom Supply

This is the first execution sequence after the Odiscom Supply tenant is confirmed and `odiscomsupply.com` is verified.

It deliberately separates **identity provisioning** from **Azure deployment** so the work can proceed safely even if an Azure subscription has not yet been attached.

## 0. Preconditions

Confirmed facts:

- Microsoft Entra tenant: Odiscom Supply LLC
- initial tenant domain: `odiscomsupply.onmicrosoft.com`
- target custom domain: `odiscomsupply.com`
- Odiscom LLC is a customer of Odiscom Supply
- Odiscom LLC tenant/resources are out of scope
- `os.odiscom.com` is out of scope

Before running anything:

- sign in to Azure CLI using the Odiscom Supply administrator;
- capture the Odiscom Supply tenant ID from Entra;
- verify `odiscomsupply.com` shows Verified in Entra.

## 1. Run preflight

From a trusted administrator workstation:

```powershell
./scripts/microsoft/preflight-odiscom-supply.ps1 -TenantId '<ODISCOM-SUPPLY-TENANT-ID>'
```

Expected result:

- tenant ID matches;
- organization display name is Odiscom Supply LLC;
- `odiscomsupply.com` is verified;
- visible Azure subscriptions are listed;
- no write operation occurs.

If the script exits because the custom domain is not verified, stop. Do not bypass the check.

## 2. Create Odiscom Supply internal groups/app

Run:

```powershell
./scripts/microsoft/bootstrap-entra-internal.ps1 -TenantId '<ODISCOM-SUPPLY-TENANT-ID>'
```

Expected groups:

- OdiscomSupply-Platform-Admins
- OdiscomSupply-Operations
- OdiscomSupply-Sales
- OdiscomSupply-Procurement
- OdiscomSupply-Fulfillment
- OdiscomSupply-Finance
- OdiscomSupply-ReadOnly

Expected app:

- Odiscom Supply Internal API

Do not assign all users automatically.

## 3. Configure app roles

Run:

```powershell
./scripts/microsoft/configure-entra-app-roles.ps1 -TenantId '<ODISCOM-SUPPLY-TENANT-ID>'
```

This assigns the designed app roles to the Odiscom Supply groups.

Validate in Entra Enterprise Applications that the group assignments are present.

## 4. Named administrator identity

Create/confirm a named administrator under the Odiscom Supply domain.

Target pattern:

- `jeff@odiscomsupply.com`

Do not use:

- `sales@odiscomsupply.com` as an administrator;
- a generic/shared mailbox as the only Global Administrator.

Keep the original bootstrap administrator until the new named admin and recovery access are proven.

## 5. Recovery administration

Before removing or reducing bootstrap access:

- configure MFA for the named admin;
- create/confirm emergency recovery access;
- test sign-in;
- document ownership.

Do not lock the tenant to a single administrator account.

## 6. Azure subscription decision

If preflight shows no Azure subscription in the Odiscom Supply tenant:

- acquire or attach an Azure subscription explicitly for Odiscom Supply;
- do not reuse an Odiscom LLC subscription by assumption.

If shared billing is intentionally approved later, resource ownership and RBAC must still be isolated.

## 7. Azure test resource group

Create a non-production resource group owned by Odiscom Supply.

Recommended naming:

- `rg-odiscom-supply-test`

Preferred location should be selected based on service availability, latency, and company policy before provisioning.

## 8. SQL administrator group

Choose/create an Odiscom Supply Entra group to administer Azure SQL.

Do not use an Odiscom LLC group.

Capture:

- group display name;
- group object ID.

These are inputs to `infra/main.bicep`.

## 9. Azure DevOps

Create an Odiscom Supply Azure DevOps organization/project.

Target repository migration:

- current GitHub repository -> Azure DevOps Repos

Target pipeline:

- `azure-pipelines.yml`

Use workload identity federation for the Azure service connection.

Do not store long-lived Azure credentials in pipeline variables.

## 10. Test infrastructure deployment

Configure these protected Azure DevOps variables:

- `azureServiceConnection`
- `resourceGroupName`
- `sqlEntraAdminLogin`
- `sqlEntraAdminObjectId`
- `sqlBootstrapPassword` (secret)

Run pipeline validation and what-if first.

Review the what-if output before allowing deployment.

## 11. Apply Azure SQL schema

After infrastructure is deployed:

1. `001_core_schema.sql`
2. `002_material_upload.sql`
3. `003_migration_control.sql`

Do not load production data yet.

## 12. Key Vault supplier secrets

Create secrets only in the Odiscom Supply Key Vault:

- `digikey-client-id`
- `digikey-client-secret`
- optional `digikey-account-id`
- `mouser-api-key` when available

Never paste these values into source code, Bicep parameter files, or public/client configuration.

## 13. Supplier connector test

Deploy the Azure Functions package to TEST.

Run exact manufacturer/MPN validation.

Initial reference case:

- Red Lion Controls / N-Tron 1005TX

Successful technical lookup is not the same as declaring supplier inventory current or the source fully production-activated.

## 14. First migration rehearsal

Run:

- source audit;
- customer master extraction;
- controlled export;
- target load;
- target audit;
- relationship reconciliation;
- file checksum reconciliation.

The current source baseline includes Odiscom LLC transactions even though the old customer table has no row.

The target must create Odiscom LLC as a normal customer organization with `IsRelatedCompany=1`, not as an internal platform organization.

## 15. Internal SharePoint

Only after Odiscom Supply SharePoint is available:

- create Odiscom Supply Operations;
- configure Odiscom Supply groups;
- create libraries and internal surfaces from `SHAREPOINT-INTERNAL-TOPOLOGY.md`;
- use `Sites.Selected` for app-only access;
- prove an unapproved site is inaccessible.

Do not touch Odiscom LLC SharePoint.

## 16. Hold points

Do not perform any of the following until explicitly validated:

- production DNS switch;
- Vercel shutdown;
- Supabase shutdown;
- GitHub archive;
- public storefront cutover;
- customer auth cutover;
- supplier auth cutover;
- Odiscom LLC system integration.

## Definition of success for this phase

The first live Microsoft phase is complete when:

- Odiscom Supply tenant/domain is verified;
- named internal administrator works;
- Odiscom Supply groups/app roles exist;
- Azure TEST resources deploy from code;
- Key Vault and managed identities work;
- Azure SQL schema is live in TEST;
- supplier connector executes in TEST;
- one full migration rehearsal reconciles;
- current production remains available and unchanged.
