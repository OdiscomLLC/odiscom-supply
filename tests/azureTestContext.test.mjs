import assert from 'node:assert/strict'
import test from 'node:test'
import { validateAzureTestContext } from '../scripts/microsoft/assert-azure-test-context.mjs'

const tenantId = '11111111-2222-4333-8444-555555555555'
const subscriptionId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const account = { id: subscriptionId, tenantId, state: 'Enabled' }
const input = { subscriptionId, tenantId, resourceGroup: 'rg-odiscom-supply-test', deploymentApproved: 'true' }

test('allows explicitly approved matching TEST environment', () => {
  const result = validateAzureTestContext(account, input)
  assert.equal(result.environment, 'test')
  assert.equal(result.resourceGroup, 'rg-odiscom-supply-test')
})

test('fails closed when approval missing', () => {
  assert.throws(() => validateAzureTestContext(account, { ...input, deploymentApproved: '' }), /not explicitly approved/)
})

test('rejects the wrong Azure subscription', () => {
  assert.throws(() => validateAzureTestContext({ ...account, id: tenantId }, input), /subscription differs/)
})

test('rejects the wrong tenant', () => {
  assert.throws(() => validateAzureTestContext({ ...account, tenantId: subscriptionId }, input), /tenant differs/)
})

test('rejects non-TEST resource groups', () => {
  for (const resourceGroup of ['Odiscom-AI-RG', 'rg-odiscom-supply-prod', 'rg-odiscom-supply-test/other']) {
    assert.throws(() => validateAzureTestContext(account, { ...input, resourceGroup }), /dedicated to Odiscom Supply TEST/)
  }
})

test('rejects disabled and invalid subscriptions', () => {
  assert.throws(() => validateAzureTestContext({ ...account, state: 'Disabled' }, input), /not enabled/)
  assert.throws(() => validateAzureTestContext({}, input), /differs/)
  assert.throws(() => validateAzureTestContext(account, { ...input, subscriptionId: '' }), /valid approved Azure subscription ID/)
})
