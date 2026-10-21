#!/usr/bin/env bash
# Read-only ACR/Container App TEST preflight. Requires authenticated az CLI.
# Usage: AZURE_TEST_SUBSCRIPTION_ID=... AZURE_TEST_ACR_NAME=... bash scripts/microsoft/check-container-app-acr-test.sh
set -euo pipefail
: "${AZURE_TEST_SUBSCRIPTION_ID:?Explicit TEST subscription is required}"
: "${AZURE_TEST_ACR_NAME:?Existing ACR name is required}"
RG="rg-odiscom-supply-test"
APP="ca-odiscom-supply-test"
case "${AZURE_TEST_SUBSCRIPTION_ID}" in
  *[!0-9a-fA-F-]*|'') echo "Invalid subscription input" >&2; exit 2 ;;
esac
case "${AZURE_TEST_ACR_NAME}" in
  *[!a-zA-Z0-9]*|'') echo "Invalid ACR name" >&2; exit 2 ;;
esac
ACTUAL="$(az account show --query id -o tsv)"
[[ "${ACTUAL,,}" == "${AZURE_TEST_SUBSCRIPTION_ID,,}" ]] || { echo "Wrong active subscription" >&2; exit 2; }
echo "Subscription: $ACTUAL"
echo "Tenant: $(az account show --query tenantId -o tsv)"
ACR_ID="$(az acr show --name "$AZURE_TEST_ACR_NAME" --query id -o tsv)"
[[ "${ACR_ID,,}" == "/subscriptions/${ACTUAL,,}/"* ]] || { echo "ACR is outside TEST subscription" >&2; exit 2; }
echo "ACR: $ACR_ID"
echo "ACR login server: $(az acr show -n "$AZURE_TEST_ACR_NAME" --query loginServer -o tsv)"
echo "ACR public network: $(az acr show -n "$AZURE_TEST_ACR_NAME" --query publicNetworkAccess -o tsv)"
az containerapp show --resource-group "$RG" --name "$APP" --query '{name:name,id:id,provisioningState:properties.provisioningState,identity:identity,registries:properties.configuration.registries,activeRevisionsMode:properties.configuration.activeRevisionsMode}' --output json
echo "ACR role assignments (review whether Container App managed identity has AcrPull):"
az role assignment list --scope "$ACR_ID" --all --query "[?roleDefinitionName=='AcrPull'].{principalId:principalId,role:roleDefinitionName,scope:scope}" -o json
echo "READ-ONLY preflight completed. No app revision or RBAC changes made."
