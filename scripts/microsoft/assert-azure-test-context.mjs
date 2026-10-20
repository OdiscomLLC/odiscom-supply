/**
 * Read-only guard for Azure TEST deployments.
 *
 * Usage: az account show --output json | node scripts/microsoft/assert-azure-test-context.mjs
 *
 * Required environment variables are supplied explicitly by the approved pipeline.
 * This file performs no Azure writes and never switches the active subscription.
 */
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

function normalized(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function validateAzureTestContext(account, input) {
  if (!account || typeof account !== 'object' || Array.isArray(account)) {
    throw new Error('Azure CLI account data is missing or invalid.')
  }

  const approvedSubscriptionId = normalized(input?.subscriptionId)
  const approvedTenantId = normalized(input?.tenantId)
  const resourceGroup = normalized(input?.resourceGroup)
  const enabled = normalized(input?.deploymentApproved)

  if (enabled !== 'true') {
    throw new Error('Deployment not explicitly approved (ODISCOM_TEST_DEPLOYMENT_APPROVED).')
  }
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(approvedSubscriptionId)) {
    throw new Error('A valid approved Azure subscription ID is required.')
  }
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(approvedTenantId)) {
    throw new Error('A valid approved Azure Entra tenant ID is required.')
  }
  if (!/^rg-odiscom-supply-test(?:-[a-z0-9]+)*$/.test(resourceGroup)) {
    throw new Error('Resource group must be dedicated to Odiscom Supply TEST.')
  }
  if (normalized(account.id) !== approvedSubscriptionId) {
    throw new Error('Active Azure subscription differs from explicitly approved TEST subscription.')
  }
  if (normalized(account.tenantId) !== approvedTenantId) {
    throw new Error('Active Azure tenant differs from explicitly approved TEST tenant.')
  }
  if (normalized(account.state) !== 'enabled') {
    throw new Error('Active Azure subscription is not enabled.')
  }

  return {
    subscriptionId: approvedSubscriptionId,
    tenantId: approvedTenantId,
    resourceGroup,
    environment: 'test',
  }
}

function main() {
  const account = JSON.parse(fs.readFileSync(0, 'utf8'))
  const approved = validateAzureTestContext(account, {
    subscriptionId: process.env.ODISCOM_APPROVED_SUBSCRIPTION_ID,
    tenantId: process.env.ODISCOM_APPROVED_TENANT_ID,
    resourceGroup: process.env.ODISCOM_TEST_RESOURCE_GROUP,
    deploymentApproved: process.env.ODISCOM_TEST_DEPLOYMENT_APPROVED,
  })
  console.log('Approved Azure TEST scope:', JSON.stringify(approved))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    console.error('Azure TEST scope gate FAILED:', error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
