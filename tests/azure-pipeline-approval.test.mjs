import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const pipeline = fs.readFileSync(new URL('../azure-pipelines.yml', import.meta.url), 'utf8')

test('Azure deployments must originate from an explicitly approved manual run', () => {
  for (const stage of ['PlanTest', 'DeployTest']) {
    const match = pipeline.match(new RegExp('  - stage: ' + stage + '\\n([\\s\\S]*?)(?=\\n  - stage: |$)'))
    assert.ok(match, stage + ' stage exists')
    assert.match(match[1], /Build\.Reason'\], 'Manual'/)
    assert.match(match[1], /ODISCOM_TEST_DEPLOYMENT_APPROVED'\], 'true'/)
  }
})

test('Azure deployment must have an identity guard directly before create', () => {
  assert.match(pipeline, /az account show --output json \| node scripts\/microsoft\/assert-azure-test-context\.mjs\s+az deployment group create/)
})

test('both Azure CLI phases pass explicit account and approval values', () => {
  for (const name of ['ODISCOM_APPROVED_SUBSCRIPTION_ID', 'ODISCOM_APPROVED_TENANT_ID', 'ODISCOM_TEST_RESOURCE_GROUP', 'ODISCOM_TEST_DEPLOYMENT_APPROVED']) {
    const occurrences = pipeline.match(new RegExp('^\\s+' + name + ':', 'gm')) ?? []
    assert.ok(occurrences.length >= 2, name + ' present in both phases')
  }
})
