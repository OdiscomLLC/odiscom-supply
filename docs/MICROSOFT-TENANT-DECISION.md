# Odiscom Supply — Microsoft Tenant Decision

**Date:** 2026-10-10  
**Status:** Workforce tenant confirmed; custom-domain verification and live provisioning remain execution gates  
**Company:** Odiscom Supply LLC

## Confirmed workforce tenant

Odiscom Supply LLC already has its **own Microsoft Entra workforce tenant** with initial domain `odiscomsupply.onmicrosoft.com`. The target custom domain is `odiscomsupply.com`.

This is the preferred long-term design because Odiscom Supply LLC is a separate company from Odiscom LLC and Odiscom LLC is a customer of Odiscom Supply.

## Why separate tenant ownership is preferred

A separate tenant gives Odiscom Supply independent control of:

- workforce identities;
- external customer/supplier identity configuration;
- SharePoint;
- Teams;
- Exchange;
- Entra groups and application registrations;
- Azure managed identities;
- Graph permissions;
- conditional access;
- audit logs;
- retention;
- app consent;
- service principals;
- company documents.

It prevents accidental inheritance of Odiscom LLC access and makes future accounting, ownership, sale, audit, or administration of Odiscom Supply cleaner.

## Domain direction

Primary company domain:

- `odiscomsupply.com`

Recommended Microsoft identities over time:

- staff: `name@odiscomsupply.com`;
- shared sales: `sales@odiscomsupply.com`;
- procurement/sourcing aliases as needed;
- system service identities through Entra managed identities/app registrations rather than shared user passwords.

The existing `sales@odiscom.com` mailbox may continue during transition if operationally needed, but it is an Odiscom LLC-domain identity and should not become the canonical Odiscom Supply platform identity.

No mailbox/domain change is authorized by this document alone.

## Odiscom LLC users

If Odiscom LLC personnel also work for Odiscom Supply, access should be deliberate.

Preferred options:
1. create an Odiscom Supply workforce identity for that person's Odiscom Supply role; or
2. invite an Odiscom LLC identity as an Entra B2B guest where appropriate.

Do not automatically grant every `@odiscom.com` account access to Odiscom Supply.

## Odiscom LLC customer access

Odiscom LLC's purchasing users access the **customer experience**, not the internal Odiscom Supply operations experience.

Customer identity:
- Entra External ID or an explicitly supported B2B customer mechanism.

Internal operational identity:
- Odiscom Supply workforce tenant only, unless a named guest assignment is approved.

## External identities

Use **Entra External ID** for:
- B2B customers;
- suppliers.

External accounts map to an Odiscom Supply customer or supplier organization record.

Email alone is not authorization.

## SharePoint

Create Odiscom Supply-specific SharePoint sites.

Suggested initial structure:

### Odiscom Supply Operations
Internal operations hub:
- Quotes
- Orders
- Customers
- Suppliers
- Catalog/Sourcing
- Hardware Opportunities
- Fulfillment
- Finance handoff
- Procedures

### Odiscom Supply Documents
Governed libraries:
- Customer documents
- Supplier documents
- Quotes and sales orders
- Compliance/source evidence
- Procurement records
- Internal procedures

External users should not be granted broad access to the internal SharePoint sites merely because the customer/supplier web applications use SharePoint-backed documents.

## Azure

Preferred ownership:
- Azure subscription/billing associated with Odiscom Supply tenant.

If Azure billing is ever shared operationally, resources must still be isolated by:
- subscription/resource group;
- managed identity;
- Key Vault;
- role assignments;
- naming;
- logging;
- budget;
- data ownership.

Do not deploy Odiscom Supply into Odiscom AI resource groups.

## Entra app registrations

Create new Odiscom Supply registrations for:
- public/customer web application;
- supplier portal;
- internal SharePoint/SPFx/API access as required;
- backend APIs;
- external identity flows;
- Microsoft Graph access.

Do not reuse Odiscom AI client IDs, secrets, service principals, or redirect URIs.

## Intercompany integration

A separate tenant does not prevent Odiscom LLC/Odiscom Supply automation.

Future approved integration options include:
- cross-tenant Entra application/service identity;
- API Management-protected API;
- app-only Graph grant to a selected site;
- event/webhook;
- controlled B2B guest access;
- customer-facing API.

Every cross-company flow remains explicit and auditable.

## os.odiscom.com

The tenant decision does not require any change to `os.odiscom.com`.

It remains an Odiscom LLC peer system.

If a future integration is approved, Odiscom Supply will use a documented boundary and its own identity.

## Migration impact

The tenant decision should be settled before production provisioning of:
- SharePoint;
- Entra app registrations;
- Entra External ID;
- Azure DevOps organization/project ownership;
- production Key Vault;
- production SQL;
- production Functions/App Service.

Application/data modeling can continue before the final tenant is provisioned because the architecture keeps tenant-specific IDs/configuration outside domain logic.

## Provisioning checklist

When authorized for provisioning:

1. Create/confirm Odiscom Supply Microsoft tenant.
2. Verify/add `odiscomsupply.com`.
3. Establish Global Admin break-glass governance.
4. Create Odiscom Supply staff accounts/groups.
5. Configure MFA/Conditional Access.
6. Create Odiscom Supply SharePoint Operations site.
7. Establish Azure subscription/resource hierarchy.
8. Create Azure DevOps organization/project.
9. Create Key Vault.
10. Create Entra app registrations.
11. Configure Entra External ID.
12. Provision Azure SQL, Functions, App Service, Blob, App Insights.
13. Deploy Bicep baseline.
14. Validate that Odiscom LLC tenant/resources are not implicitly accessible.

