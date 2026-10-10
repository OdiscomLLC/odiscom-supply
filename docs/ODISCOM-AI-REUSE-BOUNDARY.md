# Odiscom Supply — Odiscom AI Reuse Boundary

**Date:** 2026-10-10  
**Purpose:** Define what Odiscom Supply may reuse from Odiscom AI during the Microsoft migration without coupling Odiscom Supply LLC to Odiscom LLC systems.

## Rule

Odiscom Supply may reuse **generic engineering patterns and code techniques** from Odiscom AI.

Odiscom Supply may **not** reuse Odiscom LLC tenant-specific resources, identities, permissions, data, secrets, SharePoint sites, DNS, resource groups, subscriptions, app registrations, or runtime dependencies unless a separate intercompany integration is explicitly approved.

## Reuse these patterns

### 1. Managed identity for Azure workloads

Use managed identities for Azure Functions/App Service when accessing Microsoft services.

Preferred pattern:
- no embedded client secret when managed identity is available;
- request Microsoft Graph tokens using the `https://graph.microsoft.com/.default` scope;
- fail closed if a token cannot be obtained.

This mirrors the good Odiscom AI pattern without sharing any identity.

### 2. Key Vault for application secrets

Use Azure Key Vault for:
- DigiKey credentials,
- Mouser credentials,
- payment/webhook secrets,
- external supplier API secrets,
- inter-system integration secrets.

Grant only the required Function/App Service managed identity secret-read access.

### 3. SharePoint least privilege

Use Microsoft Graph `Sites.Selected` instead of broad tenant-wide SharePoint access wherever application-only SharePoint access is required.

For Odiscom Supply:
- register a **new Odiscom Supply app/managed identity**;
- grant only the specific Odiscom Supply SharePoint site(s);
- verify an unapproved site is inaccessible;
- do not reuse Odiscom AI's Graph app registration or site grants.

### 4. Fail-closed Microsoft Graph behavior

If SharePoint/Graph is not configured or unavailable:
- report the feature unavailable;
- do not return sample records;
- do not substitute mock credentials;
- do not fabricate successful sync results.

### 5. Graph webhook integrity

Where Graph subscriptions are used:
- validate the Graph handshake token;
- validate `clientState`;
- compare secrets safely;
- reject notifications that do not validate;
- store webhook secrets in Key Vault.

### 6. Azure Functions v4 application pattern

Reuse the general Azure Functions approach for:
- supplier connectors,
- catalog sync,
- BOM processing,
- pricing/sourcing services,
- webhooks,
- intercompany integration adapters.

Function names, storage accounts, resource groups, identities, and subscriptions must be Odiscom Supply-owned.

### 7. Dual-run and rollback gates

Do not shut down the current Odiscom Supply production stack merely because an Azure deployment exists.

For each migrated subsystem:
1. deploy Microsoft replacement;
2. run production-like validation;
3. reconcile data/results;
4. prove rollback;
5. switch traffic/workflow;
6. observe;
7. retire the legacy component only after acceptance.

### 8. Permission-aware architecture

Use identity + membership + role authorization rather than email alone.

For Odiscom Supply:
- Entra proves identity;
- Odiscom Supply owns customer/supplier/internal memberships and roles;
- authorization checks occur server-side;
- a valid identity alone is not sufficient authorization.

## Do NOT reuse these Odiscom AI specifics

### Tenant and identity configuration

Do not copy:
- Odiscom LLC tenant IDs;
- Odiscom AI app registrations;
- Odiscom AI service principals;
- Odiscom AI redirect URIs;
- Odiscom AI managed-identity client IDs;
- Odiscom LLC Entra groups;
- Odiscom LLC users as automatic Odiscom Supply admins.

### Azure resources

Do not copy or deploy into:
- Odiscom AI resource groups;
- Odiscom AI storage accounts;
- Odiscom AI Function Apps;
- Odiscom AI App Services;
- Odiscom AI subscriptions by assumption;
- Odiscom AI Key Vaults.

A shared Azure billing relationship may be considered later, but logical resource ownership and authorization must still remain separate.

### SharePoint

Do not copy or write into:
- Odiscom LLC HQ sites;
- Pursuit/Bid sites;
- Project Operations sites;
- Finance/Vendor sites;
- Odiscom AI knowledge sites;
- any SharePoint location backing `os.odiscom.com`.

Odiscom Supply gets its own SharePoint site structure.

### Auth

Do not carry forward Odiscom AI's historical or transitional Supabase-auth architecture.

Odiscom Supply target:
- internal: Microsoft Entra ID;
- external customers: Entra External ID;
- external suppliers: Entra External ID.

### Source control / CI

Odiscom AI currently contains GitHub-oriented migration history and workflows.

Odiscom Supply target is:
- Azure DevOps Repos;
- Azure Pipelines;
- Microsoft-hosted production stack.

GitHub is only a migration source until code/history is moved.

### Domain data

Do not reuse Odiscom LLC:
- opportunities,
- engineering projects,
- customers,
- vendors,
- contacts,
- bid records,
- past performance,
- registrations,
- licenses,
- financial records,
- compliance assertions.

Only records deliberately exchanged through a defined intercompany workflow may cross the boundary.

## os.odiscom.com

`os.odiscom.com` is outside the Odiscom Supply system boundary.

Odiscom Supply may later call an approved interface to `os.odiscom.com`, but the Supply migration must not:
- modify it;
- deploy to it;
- require it;
- change its authentication;
- change its SharePoint data;
- change its permissions;
- change DNS;
- write directly into its data stores.

## Odiscom LLC customer workflow

Odiscom LLC appears in Odiscom Supply as a customer organization.

A future integration can automate:
- Odiscom LLC material request/BOM -> Odiscom Supply quote request;
- Odiscom Supply quote -> Odiscom LLC purchasing review;
- accepted quote/PO -> Odiscom Supply order;
- shipment/status -> Odiscom LLC customer update.

The transaction remains an Odiscom Supply sale to an Odiscom Supply customer.

## Pattern inventory found in Odiscom AI

The following current Odiscom AI implementation patterns were reviewed as useful references:
- Key Vault + managed-identity migration gates;
- `Sites.Selected` SharePoint permission model;
- managed-identity Graph token acquisition;
- Graph webhook `clientState` validation;
- Azure Function App migration from Vercel serverless;
- fail-closed configuration checks;
- explicit rollback before legacy shutdown.

These are implementation references only, not shared runtime dependencies.

## Next build step

Build an **Odiscom Supply-specific Microsoft foundation** with:
1. tenant/governance decision;
2. Odiscom Supply Azure resource naming;
3. Odiscom Supply Entra registrations/groups;
4. Odiscom Supply SharePoint site;
5. Odiscom Supply Key Vault;
6. Odiscom Supply Azure SQL;
7. Odiscom Supply Function App;
8. Odiscom Supply App Service;
9. Odiscom Supply Blob Storage;
10. Application Insights;
11. Azure DevOps Repos/Pipelines;
12. Bicep templates.

No Odiscom LLC system change is required for this foundation.
