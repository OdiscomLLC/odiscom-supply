# Odiscom Supply Microsoft Foundation

This folder is the first executable infrastructure scaffold for the Microsoft-native Odiscom Supply platform.

It is intentionally **tenant-neutral**. It contains no Odiscom LLC tenant ID, subscription ID, SharePoint site, app registration, secret, or os.odiscom.com dependency.

## Resources in main.bicep

The current scaffold creates:

- Log Analytics workspace
- Application Insights
- Storage account with shared-key access disabled
- private Blob containers for function packages and application uploads
- Key Vault with RBAC, soft delete, and purge protection
- Azure SQL logical server
- Azure SQL serverless database
- Microsoft Entra SQL administrator
- Entra-only SQL authentication after bootstrap
- user-assigned managed identity for Azure Functions
- least-privilege Storage, App Insights, and Key Vault role assignments
- Azure Functions Flex Consumption plan
- Node.js 22 Function App
- Linux App Service plan
- Node.js 22 public/customer/supplier web app
- system-assigned managed identity for the web app

## Security posture

This scaffold deliberately avoids secrets in source control.

Required deployment-only values:

- `sqlEntraAdminLogin`
- `sqlEntraAdminObjectId`
- `sqlBootstrapPassword` (secret pipeline variable)

Azure SQL currently requires a bootstrap SQL administrator password at server creation. The template then enables **Microsoft Entra-only authentication**, so SQL authentication is not the intended runtime access path.

Supplier API credentials belong in Key Vault, with names such as:

- `digikey-client-id`
- `digikey-client-secret`
- `digikey-account-id` (optional)
- `mouser-api-key`

Do not put these in Bicep parameter files or source control.

## Network hardening gate

The first scaffold leaves public network endpoints enabled so initial deployment and migration validation can occur without pretending private networking is already configured.

Before production cutover, add and validate:

- VNet integration for App Service/Functions
- private endpoints for SQL, Storage, and Key Vault where appropriate
- private DNS zones
- SQL firewall/public-network shutdown
- Storage/Key Vault public-network restrictions
- Front Door/WAF for the public web tier

Public network shutdown must happen only after private connectivity and deployment rollback have been proven.

## Azure DevOps

`azure-pipelines.yml` is the migration target CI/CD definition.

Before running its deployment stage, create:

- an Odiscom Supply Azure DevOps project/repository
- an Azure service connection using workload identity federation
- variable group / secret variables
- an `odiscom-supply-test` environment with approvals as desired
- the target Odiscom Supply resource group

The pipeline performs a Bicep build, Function package tests, a deployment what-if, then deployment.

## No Odiscom LLC dependency

Do not configure this foundation with:

- Odiscom AI resource groups
- Odiscom LLC service principals
- Odiscom LLC SharePoint sites
- Odiscom LLC Key Vaults
- Odiscom LLC SQL databases
- os.odiscom.com resources

Any future intercompany integration must be separately approved and explicit.
