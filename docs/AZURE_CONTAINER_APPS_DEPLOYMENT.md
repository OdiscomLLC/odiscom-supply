# Odiscom Supply — Azure deployment handoff

## Isolation rules

Odiscom Supply is a separate business from Odiscom LLC. Never modify odiscom.com, os.odiscom.com, ai.odiscom.com, Odiscom LLC Entra applications or production data for this deployment. Do not change odiscomsupply.com DNS until validation and owner approval.

## Recommended Azure layout

- Confirm the owner, billing authority and security boundary before choosing an Azure subscription. Separate subscriptions and/or Entra tenants may be appropriate for legal, billing and administrator isolation.
- New resource group: `rg-odiscom-supply-prod`; assign only Odiscom Supply principals.
- Azure Container Registry for private images.
- Azure Container Apps (Consumption), single initial app `ca-odiscom-supply-prod`, ingress HTTPS port 3000, minimum replicas 0 or 1 based on cold-start tolerance.
- Azure managed identities for registry access and CI/CD via GitHub OIDC; avoid service principal passwords or credentials in Git.
- Container App secrets for backend SMTP, Supabase service role, supplier and Stripe credentials.
- Application Insights / Log Analytics, budget alerts and tags with company=OdiscomSupply.
- Continue using the existing Supabase project only if ownership, security, and data isolation have been confirmed.

## Build

The Dockerfile builds Next.js in Node 24. Three NEXT_PUBLIC_* variables are required at **image build time** if used by the browser: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and NEXT_PUBLIC_SITE_URL. These public values are embedded in the browser bundle. Never pass SUPABASE_SERVICE_ROLE_KEY, SMTP_PASS, STRIPE_SECRET_KEY or other secrets as build arguments.

Example local test:

```sh
docker build -t odiscom-supply:test --build-arg NEXT_PUBLIC_SITE_URL=https://staging.odiscomsupply.com .
docker run --rm -p 3000:3000 --env-file .env.local odiscom-supply:test
```

Review the environment file before use: do not commit any secrets.

## Required production checks

1. Confirm Azure subscription, tenant, account owner and isolation requirements; no deployment until this check.
2. Set app environment variables from Azure secrets. Confirm the correct Supply mail identity and authentication. The template currently refers to sales@odiscom.com, which must not be used for Supply business mail.
3. Provision registry, resource group and Container App in a separate scope with minimum permissions.
4. Validate homepage, catalog, quote submission, quote PDF, quote acceptance, admin authorization, order lifecycle, email, Stripe webhook authentication, and supplier API calls.
5. Verify logging, rollback to previous container revision, alerting, cost budget, and data backup.
6. Only then map staging / production domains, verify certificates and DNS, and cut over with an explicit approved change window.
7. Keep existing Vercel production available until rollback window closes. Do not delete Odiscom LLC or shared resources.

## Operational status

This branch is preparation only: no Azure subscription, DNS, CI credentials, secrets or production resources have been modified. CI/CD automation and final image publication require subscription access and identity configuration.
