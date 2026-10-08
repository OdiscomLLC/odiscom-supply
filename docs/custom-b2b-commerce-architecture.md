# Odiscom Supply custom B2B commerce architecture

## Direction

Odiscom Supply is a custom-built B2B telecom commerce platform. Shopify is not part of the runtime, data model, checkout, catalog, or fulfillment architecture.

## Core stack

- Next.js 16 storefront and buyer/admin/supplier applications
- React 19
- Supabase/PostgreSQL for current application data and authentication
- Stripe for payment and invoice workflows where electronic payment is appropriate
- SMTP/Microsoft 365-compatible notifications
- PDF quote generation
- Existing Odiscom AI / Azure integration path for opportunity intelligence, sourcing, and internal workflow

## Buyer workflows

1. Search the telecom catalog by manufacturer, part number, category, size, fiber count, or project use.
2. Open a product or select a request-catalog item.
3. Request project pricing with quantity and product context preserved.
4. Upload a BOM or material list for larger requirements.
5. Receive a reviewed quote with sourcing, lead-time, freight, and alternate considerations.
6. Accept an issued quote and convert it into an order.
7. Track quotes and orders through the buyer account.

## B2B differentiators

- Public catalog without forcing public commodity pricing
- Project-specific quote workflow
- BOM/material-list upload
- Supplier portal and supplier review
- Manufacturer/part-number sourcing
- Quantity breaks and freight-sensitive pricing
- Approved-alternate workflow
- Government and infrastructure procurement support
- Quote-to-order conversion
- Internal opportunity and sourcing workflow integration

## Guardrails

- Never fabricate stock, availability, manufacturer authorization, lead time, country of origin, pricing, or contract eligibility.
- Request-catalog entries are sourcing requests, not inventory claims.
- Issued quote prices must remain immutable once frozen by the existing quote controls.
- Card data must not be stored by Odiscom Supply; use Stripe-hosted/tokenized payment flows.
- Admin and supplier privileges must remain server-enforced and must not rely on hidden routes alone.
- Shopify must not be introduced as a dependency without an explicit future architecture decision.

## Build phases

### Phase 1 — Storefront and quote conversion
- Premium B2B homepage
- Procurement-oriented catalog search and filters
- Product-to-quote context preservation
- BOM-first call to action
- Buyer/supplier navigation cleanup

### Phase 2 — Catalog intelligence
- Manufacturer directory
- Part-number normalization
- Structured specifications and facets
- Product documents/spec sheets
- Alternate/substitution relationships
- Search ranking and synonym support

### Phase 3 — Commercial workflow
- Quote basket / saved project list
- Buyer organizations and contacts
- Tax-exempt/resale documentation
- Freight and delivery preferences
- PO checkout
- Stripe payment/invoice flows
- Order acknowledgements and status

### Phase 4 — Odiscom AI integration
- Opportunity-to-BOM extraction
- Supplier RFQ generation
- Quote comparison
- Margin and sell-price review
- Award-to-order conversion
- SharePoint/Azure document retention and internal workflow
