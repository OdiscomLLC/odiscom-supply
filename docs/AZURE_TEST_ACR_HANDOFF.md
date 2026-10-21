# Odiscom Supply Azure TEST: Azure Container Registry (ACR)

## Goal

Replace the GHCR pull dependency for **TEST** only. The standalone smoke image is built from the existing `deploy/azure-container-apps-test-20261020` Dockerfile and does not use production Supabase connection values. No DNS or Odiscom LLC app changes are part of this workflow.

## Steps and required privileges

1. An Azure administrator approves **one** TEST subscription and its associated tenant, confirms the subscription legal payer and estimated ACR costs, and creates or chooses a dedicated `odiscom-supply` ACR (Basic is adequate for initial smoke testing), with a clear cost center and tag.
2. Create a federated GitHub Actions credential scoped to `OdiscomLLC/odiscom-supply` **environment** `odiscom-supply-test-acr`, and limit its roles to the target ACR as much as Azure ACR Tasks permits. Ensure Azure policy allows `az acr build`; it submits a remote build and incurs possible registry/build charges.
3. Configure GitHub **environment** `odiscom-supply-test-acr` with required reviewers and values:
   - secrets: `AZURE_TEST_CLIENT_ID`, `AZURE_TEST_TENANT_ID`, `AZURE_TEST_SUBSCRIPTION_ID`
   - variable: `AZURE_TEST_ACR_NAME`
4. Manually run `.github/workflows/azure-test-acr.yml` and select `YES`. The workflow verifies its active subscription, tenant, registry subscription, tests, and Next.js build before pushing `odiscom-supply:azure-test-<commit SHA>`.
5. Grant the **existing TEST Container App managed identity** `AcrPull` on the ACR. Prefer a user-assigned identity explicitly scoped to TEST and check its principal ID and role grant before attempting a revision.
6. Validate with a TEST-only Container App revision after a separate inspection/approval of the exact Container App, registry and image tag. Do not automatically update the app in this workflow.

## Why not direct deployment in the workflow?

The existing `ca-odiscom-supply-test` failed with GHCR authentication. Changing a registry does not itself grant the Container App pull rights. The ACR publish workflow does **not** update any Container App or attempt to assign Azure RBAC. This intentionally separates image publishing from resource changes. No Azure connection is currently proven from GitHub merely because tests pass.

## Other migration gates

This is only an image delivery improvement, **not** completion of Azure SQL, Blob, Entra/SharePoint, customer/supplier auth, payment integration or production cutover. Keep the historical source snapshot/reconciliation controls. Odiscom LLC remains a separate customer of Odiscom Supply, and `os.odiscom.com` is out of scope.
