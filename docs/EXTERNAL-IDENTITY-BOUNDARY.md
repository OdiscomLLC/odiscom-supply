# Odiscom Supply External Identity Boundary

**Company:** Odiscom Supply LLC  
**Target identity service:** Microsoft Entra External ID in a dedicated external tenant  
**Audience:** external B2B customers and external suppliers

The customer portal and supplier portal must use Microsoft Entra External ID in a dedicated **external tenant**, separate from the Odiscom Supply workforce tenant. The workforce tenant remains for Odiscom Supply personnel, SharePoint, Azure administration, and internal applications.

## Customer identity model

An authenticated external customer maps to exactly one or more approved customer organizations:

`external identity -> ExternalOrganizationMember -> ExternalOrganization(customer) -> commerce.Customer`

Required rules:

- customer identity does not grant SharePoint site membership;
- customer identity never grants an internal Odiscom Supply app role;
- customer access is always scoped by customer organization ID;
- customer organization ID, not email suffix, is the authorization boundary;
- Odiscom LLC is handled through this same customer organization model.

## Supplier identity model

An authenticated external supplier maps to:

`external identity -> ExternalOrganizationMember -> ExternalOrganization(supplier) -> sourcing.Supplier`

Required rules:

- supplier identity does not grant internal staff access;
- supplier users can access only their own supplier organization;
- supplier users cannot see Odiscom Supply margin logic, other suppliers, customer data, or internal opportunity scoring;
- supplier self-registration does not automatically create an approved supplier relationship.

## Registration policy

External self-service registration may create an identity, but it must not automatically grant business-data access.

Access requires successful authentication, verified/approved organization association, active organization membership, and application-side authorization.

## Customer vs supplier separation

The same email address could theoretically participate in multiple external organizations.

Authorization therefore cannot be based solely on email.

Store explicit organization memberships and roles such as customer buyer, customer administrator, supplier sales representative, and supplier administrator.

## Internal workforce separation

Internal Odiscom Supply staff authenticate with the workforce Entra tenant and receive app roles such as Platform.Admin, Operations.User, Sales.User, Procurement.User, Fulfillment.User, Finance.User, and ReadOnly.User.

External identities receive none of those roles by default.

## Shared mailbox rule

`sales@odiscomsupply.com` is a shared business mailbox. It is not a Global Administrator, application identity, external customer identity, or external supplier identity.

## Odiscom LLC as customer

Odiscom LLC receives normal customer access to its customer profile, BOM/material uploads, Odiscom Supply quotes, Odiscom Supply orders, and customer-visible shipments/documents.

It does not receive supplier pricing from unrelated transactions, internal cost/margin fields, Odiscom Supply platform administration, Odiscom Supply supplier-management data, or broad SharePoint access.

## Future intercompany automation

If Odiscom LLC systems later send BOMs or receive order status automatically, use a separate service-to-service integration identity.

Do not reuse a human customer login for automated integration.

The interface must be documented, authenticated, scoped, auditable, revocable, and independent of `os.odiscom.com` internals.

## Migration from current Supabase auth

The existing Supabase customer/supplier login flows are transitional.

Do not broaden them while migration is in progress.

Cutover to Entra External ID occurs only after organization membership mapping is loaded, customer isolation tests pass, supplier isolation tests pass, account recovery flows pass, existing customer/supplier records reconcile, and rollback is available.
