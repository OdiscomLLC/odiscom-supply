import test from 'node:test'
import assert from 'node:assert/strict'
import { validateAzureTestContext } from '../scripts/microsoft/assert-azure-test-context.mjs'

const subscriptionId = '11111111-1111-4111-8111-111111111111'
const tenantId = '22222222-2222-4222-8222-222222222222'
const account = { id: subscriptionId, tenantId, state: 'Enabled' }
const input = { subscriptionId, tenantId, resourceGroup: 'rg-odiscom-supply-test', deploymentApproved: 'true' }

test('approved TEST context passes', () => {
  assert.equal(validateAzureTestContext(account, input).environment, 'test')
})

test('deployment defaults to blocked', () => {
  assert.throws(() => validateAzureTestContext(account, { ...input, deploymentApproved: undefined }), /not explicitly approved/)
})

test('wrong subscription is rejected', () => {
  assert.throws(() => validateAzureTestContext({ ...account, id: tenantId }, input), /subscription differs/)
})

test('wrong tenant is rejected', () => {
  assert.throws(() => validateAzureTestContext({ ...account, tenantId: subscriptionId }, input), /tenant differs/)
})

test('disabled subscription is rejected', () => {
  assert.throws(() => validateAzureTestContext({ ...account, state: 'Disabled' }, input), /not enabled/)
})

test('production or unrelated resource groups are rejected', () => {
  for (const resourceGroup of ['rg-odiscom-supply-prod', 'Odiscom-AI-RG', 'rg-odiscom-supply-test/other']) {
    assert.throws(() => validateAzureTestContext(account, { ...input, resourceGroup }), /dedicated to Odiscom Supply TEST/)
  }
})
