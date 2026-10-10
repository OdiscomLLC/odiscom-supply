# Odiscom Supply — Entra External ID Tenant Decision

**Date:** 2026-10-10  
**Status:** Approved target architecture  
**Company:** Odiscom Supply LLC

## Decision

Odiscom Supply will use **two Microsoft Entra tenant configurations with different purposes**:

1. **Odiscom Supply workforce tenant**
   - existing tenant: Odiscom Supply LLC
   - internal employees/admins
   - SharePoint
   - internal application roles
   - Azure administration
   - Azure DevOps ownership
   - internal Odiscom Supply applications

2. **Dedicated Entra external tenant**
   - external B2B customers
   - external suppliers
   - sign-up/sign-in user flows for customer/supplier applications
   - customer/supplier application registrations
   - external user directory

Microsoft's current External ID model treats an external tenant as a separate tenant configuration for customer-facing applications. It is not the same thing as inviting guests into the workforce tenant.

## Why this matters

Do not place public customer/supplier identities into the workforce directory merely because they need to sign in to odiscomsupply.com.

The workforce tenant is for Odiscom Supply personnel and internal resources.

The external tenant is for customer-facing and supplier-facing app identities.

This preserves:

- internal/external identity separation;
- cleaner authorization;
- simpler lifecycle management;
- lower risk of accidental SharePoint/internal-app access;
- company-grade auditability.

## External tenant naming

Recommended display name:

- **Odiscom Supply External**

Candidate initial domain:

- `odiscomsupplyexternal.onmicrosoft.com`

The actual initial domain must be checked for availability at creation time. Do not assume the candidate is available.

Do not create another workforce tenant to solve this problem. The additional tenant must be created with Microsoft's **External** tenant configuration.

## Azure prerequisite

Current Microsoft guidance requires an Azure subscription and sufficient Tenant Creator permission for creating an external tenant under the normal subscription-backed flow.

Therefore:

- do not create the external tenant until an Odiscom Supply Azure subscription is explicitly available/approved;
- do not attach it to an Odiscom LLC subscription by assumption.

## Customer and supplier apps

Use one dedicated external tenant initially, with separate application registrations/user-flow policy where appropriate for:

### Customer application

Audience:
- contractors;
- ISPs;
- integrators;
- public-sector buyers;
- commercial buyers;
- Odiscom LLC as a customer.

Capabilities:
- account/profile;
- BOM/material upload;
- quotes;
- quote acceptance;
- orders;
- shipment status;
- customer documents.

### Supplier application

Audience:
- manufacturers;
- distributors;
- supplier representatives.

Capabilities:
- supplier profile;
- offers;
- catalog/feed submission;
- RFQ response;
- supplier documents;
- supplier-specific status.

## Business authorization still belongs to Odiscom Supply

The external tenant authenticates the user.

Odiscom Supply's application/database still determines what organization the user belongs to and what they may access.

Canonical model:

`External tenant identity -> ExternalOrganizationMember -> ExternalOrganization -> Customer or Supplier`

Email alone is not authorization.

## Customer/supplier overlap

If the same person participates in multiple organizations or roles, store explicit membership records.

Examples:

- customer buyer;
- customer admin;
- supplier sales rep;
- supplier admin.

Do not infer access from an email domain.

## Odiscom LLC

Odiscom LLC remains a normal Odiscom Supply customer.

Its purchasing users authenticate through the customer experience in the external tenant.

They do not receive internal Odiscom Supply workforce permissions from that customer relationship.

If an Odiscom LLC employee separately performs an Odiscom Supply internal role, that is handled through the Odiscom Supply workforce tenant and explicit internal role assignment.

## SharePoint

External customer/supplier identity does not imply membership in the Odiscom Supply internal SharePoint site.

Protected files are delivered through the application/API layer unless a specific sharing workflow is deliberately approved.

## Intercompany system integration

Future automated integration with Odiscom LLC or `os.odiscom.com` should use a dedicated service-to-service identity/API contract.

Do not use customer human-login tokens as the machine-integration mechanism.

## Migration impact

Current Supabase external auth remains transitional until:

- the external tenant exists;
- customer and supplier app registrations exist;
- sign-up/sign-in flows are configured;
- organization mappings are loaded;
- isolation tests pass;
- rollback is ready.

Do not remove Supabase auth before those gates pass.

## Execution order

1. verify `odiscomsupply.com` in the workforce tenant;
2. establish Odiscom Supply Azure subscription;
3. provision internal workforce groups/apps/Azure TEST resources;
4. create the **external tenant** using the External configuration;
5. register customer and supplier applications in the external tenant;
6. configure sign-up/sign-in flows;
7. connect external identities to Odiscom Supply organization records;
8. validate customer and supplier isolation;
9. migrate external authentication;
10. retire Supabase authentication only after successful cutover.

## Hard boundary

The external tenant is still owned by Odiscom Supply LLC.

It is not:

- an Odiscom LLC tenant;
- an Odiscom AI tenant;
- an `os.odiscom.com` tenant;
- a shared identity directory between the companies.
