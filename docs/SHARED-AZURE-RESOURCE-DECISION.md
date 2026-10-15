# Odiscom Supply / Odiscom LLC — Shared Azure Resource Decision & Migration Gate

**Decision recorded:** 2026-10-15  
**Scope:** Odiscom Supply LLC and Odiscom LLC may share Azure resources when doing so is useful.  
**Status:** Architecture authorization, **not** authorization to deploy, modify an existing Odiscom LLC environment, expose data, or incur new charges.

## What the decision changes

The two businesses do **not** require duplicate Azure subscriptions, billing arrangements, hosting capacity, monitoring infrastructure, or networking solely because they are separate legal entities. A shared Azure billing relationship, subscription, or selected platform resource is permitted after its owner, identity tenant, billing allocation, operational dependencies, and access grants have been reviewed. Shared services are an **option**, not the default for every component.

The Odiscom Supply workforce Entra tenant remains `odiscomsupply.onmicrosoft.com`; Odiscom LLC remains a separate legal business and is an ordinary purchasing customer of Odiscom Supply. Sharing Azure infrastructure does not merge Entra directories, company records, customers, sales books, contracts, permissions, or tax identities.

## Target layout: economical but auditable

| Layer | May share? | Minimum control |
| --- | --- | --- |
| Azure billing account / subscription | **Yes, with owner approval** | Define legal payer, tenant association, chargeback, access model, budgets and tags |
| Log Analytics / Azure Monitor | **Yes** | Role-scoped access; prevent sensitive log leakage; per-workload alerts and retention |
| Container registry / CI runners / generalized build tooling | **Yes** | Per-repository credentials/scopes, isolated deployment approvals, no common production secrets |
| App Service/Container Apps hosting capacity or networking | **Potentially** | Document lifecycle coupling, runtime isolation, scaling, egress and ingress policy before adoption |
| Resource groups for company workloads | **Prefer separate** | Odiscom Supply resource-group ownership, tags, change controls and RBAC |
| SQL databases, Blob containers, Key Vault secrets, customer documents, supplier data, commerce records | **Separate logical and security boundaries** | Company-specific identities, encrypted storage, RBAC, backup/restore and retention; no implicit cross-access |
| Entra app identities, Graph consent and SharePoint site permissions | **Company-specific permissions** | Approved per-app, per-site or cross-tenant grants; never reuse an unrelated admin credential |
| `os.odiscom.com` or existing Odiscom LLC production services | **No unreviewed modification** | Explicit integration and written change approval; availability and rollback gates |

**Azure tenant caveat:** An Azure subscription is associated with one Entra tenant at a time. Cross-tenant workloads need a deliberate management/deployment model (for example approved B2B identities, service connections, or distinct subscriptions). Existing Odiscom Supply Bicep assumes SQL admin, managed identities and Key Vault align with the deployed subscription's tenant; do not override the template `tenantId` to the other company's tenant as a shortcut. Validate principal IDs, SQL Entra admin eligibility, resource-provider behavior, Key Vault permissions and deployment identity before enabling a shared-subscription path.

## Required decision record before deployment

For every shared Azure platform or subscription, record:
1. Owning Azure subscription ID and **active directory tenant ID**; payer and explicit company-level billing consent.
2. Affected resource-group IDs, allowed resource/service list and existing production dependencies.
3. Workload owner, Azure RBAC groups and service identity, with least-privilege grants.
4. Tags: `company`, `costCenter`, `workload`, `environment`, `owner` plus distinct cost dashboard/budget alert recipients. Budgets are **notifications**, not hard spend limits.
5. Technical isolation: SQL database/access, Storage containers, Key Vault permissions, network policy, backups, retention, logging, incident response.
6. Test-mode `what-if`, required Azure quotas, expected monthly spend and potential shared-infrastructure blast radius.
7. Explicit go/no-go for changes to Odiscom LLC resources, including `os.odiscom.com`. No change is implicit.

## Current migration readiness (2026-10-15)

- Odiscom Supply workforce Entra tenant confirmed; resolve the tenant ID only from approved environment configuration during deployment.
- Azure billing/legal ownership is under review. Confirm the approved payer, billing authority and subscription ownership before provisioning; keep support identifiers and billing records out of this repository.
- No new Azure production subscription has been confirmed created.
- Existing GitHub `main` at `13aa8cab08aaab349ac9ed960117963c44a3111d` contains Azure SQL schema, TEST-only SQL rehearsal loader, TEST-only Blob migrator and Bicep App Service/Functions/SQL foundation. These are source artifacts **not evidence of a successful Azure deployment**.
- Draft PR [#31](https://github.com/OdiscomLLC/odiscom-supply/pull/31) proposes an alternative Container Apps Docker deployment retaining Supabase temporarily. Do not merge it just to unblock the migration; select App Service + full Microsoft migration versus phased Container Apps transition, then validate build, billing, and rollback.
- Current file migration documentation flags a historical supplier-import workbook whose binary lacks a retrievable storage reference. The normalized import rows are preserved; recover the original XLSX separately if it must be archived.

## Safe parallel work while billing support is open

1. Read-only verification of source audit, schema coverage, file-inventory reconciliation and stored snapshot availability.
2. Static build/test review of the existing Bicep and TEST scripts, without touching live infrastructure.
3. Decide the **hosting strategy** and whether any specific resource should be shared (not just whether sharing is permitted).
4. Prepare subscription/tenant/RBAC matrix and projected costs for TEST and PROD.
5. Prepare a non-production deployment plan. Do not run it until owner approval, subscription identity validation, billing correction/authorized billing arrangement and `what-if` acceptance.
6. Protect Vercel/Supabase production until both application and data reconciliation pass and rollback is proven.

## Cutover conditions

Independent supplier/customer/internal authentication validation; authorization boundary tests; consistent SQL and Blob reconciliations (including missing originals); secure payment/webhook flow; tested backups and rollback; explicit domain/DNS change approval; monitoring and chargeback reporting; no unapproved impact to `os.odiscom.com`.

**This decision supersedes any older blanket documentation rule that Odiscom LLC and Odiscom Supply can never share Azure subscriptions or platform resources; all data-ownership, least-privilege and existing-production safeguards still apply.**
