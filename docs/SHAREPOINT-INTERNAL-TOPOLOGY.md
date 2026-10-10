# Odiscom Supply SharePoint Internal Topology

**Company:** Odiscom Supply LLC  
**Scope:** Internal operations only  
**Identity:** Odiscom Supply Microsoft Entra workforce tenant

This topology is intentionally separate from Odiscom LLC SharePoint, Odiscom AI, and `os.odiscom.com`.

## Primary site

### Odiscom Supply Operations

Recommended site type: private Team Site or private operations hub.

Purpose:
- internal command center;
- staff dashboards;
- sourcing and procurement operations;
- quote/order review;
- supplier review;
- fulfillment;
- governed internal documents.

External customers and suppliers do **not** receive site membership merely because they have an Odiscom Supply portal account.

## Proposed document libraries

### Operations Documents
For:
- operating procedures;
- approved templates;
- internal reference material;
- migration/cutover runbooks.

### Customer Records
For:
- customer tax/resale documentation;
- PO support documents;
- customer-specific sales records where SharePoint is the governed document system.

Customer portal access should be mediated by the application/API unless a specific SharePoint sharing design is approved.

### Supplier Records
For:
- supplier applications;
- line cards;
- reseller/distributor agreements;
- compliance/source evidence;
- supplier quotes and correspondence artifacts.

### Procurement Evidence
For:
- BOMs;
- manufacturer/distributor quotes;
- source/compliance evidence;
- opportunity sourcing packages.

### Sales Orders and Fulfillment
For:
- generated quote/order PDFs;
- packing/shipping documentation;
- fulfillment evidence.

## Proposed Lists / operational surfaces

SharePoint Lists should be used for collaboration-oriented operational state, not as a replacement for Azure SQL transactional data.

Appropriate candidates:
- internal task queues;
- review/approval queues;
- process checklists;
- document-review status;
- exception queues.

Azure SQL remains the system of record for:
- products;
- suppliers;
- supplier offers;
- customers;
- quotes;
- orders;
- hardware opportunities;
- normalized sourcing data.

## SPFx internal workspace

The future SPFx experience should provide:

- Operations Dashboard
- Quotes
- Orders
- Customers
- Suppliers
- Catalog & Supplier Offers
- Catalog Imports
- Hardware Opportunities
- BOM Sourcing
- Fulfillment
- Compliance Review
- Platform/Connector Health

SPFx calls Azure APIs using the signed-in user's Microsoft identity. Authorization is enforced server-side by Entra group/app-role membership.

## Entra group mapping

Recommended groups:

| Group | Primary access |
| --- | --- |
| OdiscomSupply-Platform-Admins | platform configuration and admin |
| OdiscomSupply-Operations | broad operational workflows |
| OdiscomSupply-Sales | customers, quotes, sales orders |
| OdiscomSupply-Procurement | suppliers, sourcing, offers, RFQs |
| OdiscomSupply-Fulfillment | orders, shipping, delivery |
| OdiscomSupply-Finance | finance-facing records and handoff |
| OdiscomSupply-ReadOnly | read-only internal visibility |

Membership must be explicit.

An `@odiscom.com` address does not automatically grant internal Odiscom Supply access.

## Graph permissions

Use least privilege.

For application-only access:
- prefer `Sites.Selected`;
- grant only the Odiscom Supply site(s);
- verify an unapproved site is inaccessible.

Do not grant Odiscom Supply applications access to Odiscom LLC SharePoint by default.

## External customer/supplier files

Customers and suppliers should use the external web applications and Entra External ID.

Do not add customer/supplier users to the internal SharePoint operations site as the default portal architecture.

## os.odiscom.com

No SharePoint site, library, list, SPFx package, permission, or Graph grant related to `os.odiscom.com` is changed by this topology.

Future integration must use an explicit intercompany interface.
