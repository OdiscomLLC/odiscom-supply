# Odiscom Supply Entra Authorization Contract

**Company:** Odiscom Supply LLC  
**Scope:** Internal workforce authorization and external organization authorization  
**Target:** Microsoft-native production stack

This contract defines what a Microsoft identity is allowed to do after authentication. Authentication alone never grants Odiscom Supply data access.

## Internal application roles

The internal Odiscom Supply API exposes these application roles:

| App role | Purpose |
| --- | --- |
| Platform.Admin | Full Odiscom Supply platform administration |
| Operations.User | Broad internal operations access |
| Sales.User | Customer, quote, and sales-order workflows |
| Procurement.User | Supplier, sourcing, RFQ, offer, and catalog workflows |
| Fulfillment.User | Order fulfillment, shipment, and delivery workflows |
| Finance.User | Finance-facing order/payment/invoice handoff |
| ReadOnly.User | Read-only internal access |

Recommended Entra group assignment:

| Entra group | App role |
| --- | --- |
| OdiscomSupply-Platform-Admins | Platform.Admin |
| OdiscomSupply-Operations | Operations.User |
| OdiscomSupply-Sales | Sales.User |
| OdiscomSupply-Procurement | Procurement.User |
| OdiscomSupply-Fulfillment | Fulfillment.User |
| OdiscomSupply-Finance | Finance.User |
| OdiscomSupply-ReadOnly | ReadOnly.User |

A person may hold multiple roles.

## Internal API authorization rules

The API validates:

1. token issuer belongs to the approved Odiscom Supply tenant;
2. token audience matches the Odiscom Supply API application;
3. token is not expired;
4. subject/object ID is present;
5. required app role is present;
6. high-risk operations also confirm the principal is active in Odiscom Supply internal role assignment data when that secondary control is enabled.

Do not authorize internal access by email-domain suffix alone.

An `@odiscom.com` identity is not automatically internal Odiscom Supply staff.

## Internal role examples

### Platform.Admin

May:
- manage platform configuration;
- manage connector configuration;
- review failed imports;
- manage internal role assignments;
- inspect platform health;
- run controlled data migrations.

Does not imply:
- permission to alter Odiscom LLC systems;
- access to os.odiscom.com;
- access to Odiscom LLC SharePoint.

### Procurement.User

May:
- manage supplier records;
- run supplier lookups;
- review supplier offers;
- manage catalog imports;
- prepare supplier RFQs;
- review sourcing/compliance evidence.

### Sales.User

May:
- manage customer accounts;
- prepare quotes;
- review quote acceptance;
- create/manage sales orders.

### Fulfillment.User

May:
- update fulfillment state;
- create shipment records;
- update tracking/delivery events.

### Finance.User

May:
- review payment references;
- review PO/customer references;
- support accounting handoff.

### ReadOnly.User

May read internal operational data but cannot mutate it.

## External customer identity

External customer authentication uses Entra External ID.

A customer identity maps to:

`Entra external subject/object ID -> ExternalOrganizationMember -> ExternalOrganization(customer) -> commerce.Customer`

Authorization always filters by the resolved customer organization ID.

A customer must not be able to query:
- another customer;
- supplier-only records;
- internal-only fields;
- internal opportunity/sourcing data.

Odiscom LLC follows this same customer model.

## External supplier identity

External supplier authentication uses Entra External ID.

A supplier identity maps to:

`Entra external subject/object ID -> ExternalOrganizationMember -> ExternalOrganization(supplier) -> sourcing.Supplier`

A supplier may access:
- its own profile;
- its own contacts;
- its own offers;
- its own catalog/import submissions;
- its own RFQ responses;
- documents explicitly shared for its supplier organization.

A supplier may not access:
- other suppliers;
- customer records;
- internal margin/pricing decisions;
- internal opportunity intelligence;
- platform administration.

## Odiscom LLC boundary

Odiscom LLC is a customer organization.

If an Odiscom LLC employee also performs work for Odiscom Supply, that person receives internal access only through a separately assigned Odiscom Supply workforce/guest identity and explicit Odiscom Supply role.

Customer membership and internal workforce membership are separate relationships.

## Token claims used by the API

For internal workforce tokens, the API expects:

- `tid` — tenant ID;
- `oid` — Entra object ID;
- `aud` — Odiscom Supply API audience/client ID;
- `roles` — assigned application roles;
- standard issuer/expiration claims.

Email/UPN may be logged as a contact/display attribute but is not the canonical authorization key.

## Fail-closed behavior

If identity configuration is incomplete or claims are missing:

- deny protected operation;
- return a non-sensitive authorization error;
- log correlation ID and principal object ID when available;
- never fall back to a hard-coded admin email;
- never grant access simply because a user is authenticated.

## Transitional Vercel/Supabase period

The current Supabase admin model remains production until the Microsoft internal API is deployed and validated.

Do not weaken current Supabase `requireAdmin` controls during transition.

The Entra contract is the target replacement, not an instruction to bypass the current guard.
