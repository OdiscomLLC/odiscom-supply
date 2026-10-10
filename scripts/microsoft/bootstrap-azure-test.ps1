param(
  [Parameter(Mandatory = $true)]
  [string]$TenantId,

  [Parameter(Mandatory = $true)]
  [string]$SubscriptionId,

  [Parameter(Mandatory = $true)]
  [string]$SqlEntraAdminLogin,

  [Parameter(Mandatory = $true)]
  [string]$SqlEntraAdminObjectId,

  [Parameter(Mandatory = $true)]
  [securestring]$SqlBootstrapPassword,

  [string]$ExpectedDomain = 'odiscomsupply.com',
  [string]$ResourceGroupName = 'rg-odiscom-supply-test',
  [string]$Location = 'southcentralus'
)

$ErrorActionPreference = 'Stop'

function Invoke-AzText {
  param([string[]]$Arguments)
  $output = & az @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Azure CLI failed: az $($Arguments -join ' ')`n$output"
  }
  return ($output | Out-String).Trim()
}

$currentTenant = Invoke-AzText @('account','show','--query','tenantId','-o','tsv')
if ($currentTenant.ToLowerInvariant() -ne $TenantId.ToLowerInvariant()) {
  throw "Wrong tenant. Authenticated tenant '$currentTenant' does not match Odiscom Supply tenant '$TenantId'."
}

$subscriptionJson = Invoke-AzText @('account','show','--subscription',$SubscriptionId,'--output','json')
$subscription = $subscriptionJson | ConvertFrom-Json
if (-not $subscription.id -or $subscription.id.ToLowerInvariant() -ne $SubscriptionId.ToLowerInvariant()) {
  throw "Subscription '$SubscriptionId' could not be resolved."
}
if ($subscription.tenantId.ToLowerInvariant() -ne $TenantId.ToLowerInvariant()) {
  throw 'Refusing to deploy. Subscription is not associated with the supplied Odiscom Supply tenant.'
}

Invoke-AzText @('account','set','--subscription',$SubscriptionId) | Out-Null

$organizationJson = Invoke-AzText @(
  'rest','--method','GET',
  '--url','https://graph.microsoft.com/v1.0/organization?$select=id,displayName,verifiedDomains',
  '--output','json'
)
$organization = (($organizationJson | ConvertFrom-Json).value | Select-Object -First 1)

if (-not $organization -or $organization.displayName -ne 'Odiscom Supply LLC') {
  throw 'Authenticated organization is not Odiscom Supply LLC.'
}

$verifiedDomain = $organization.verifiedDomains | Where-Object { $_.name -eq $ExpectedDomain } | Select-Object -First 1
if (-not $verifiedDomain) {
  throw "Custom domain '$ExpectedDomain' is not verified. Refusing to deploy Azure TEST resources."
}

if ($ResourceGroupName -notmatch '^rg-odiscom-supply-test') {
  throw "Resource group '$ResourceGroupName' does not match the guarded Odiscom Supply TEST naming convention."
}

Write-Host "Ensuring TEST resource group $ResourceGroupName in $Location..." -ForegroundColor Cyan
Invoke-AzText @('group','create','--name',$ResourceGroupName,'--location',$Location,'--tags','company=Odiscom Supply LLC','environment=test','managedBy=Bicep','--output','none') | Out-Null

$bicepPath = Join-Path $PSScriptRoot '..\..\infra\main.bicep'
if (-not (Test-Path $bicepPath)) {
  throw "Bicep template not found: $bicepPath"
}

$plainPassword = [System.Net.NetworkCredential]::new('', $SqlBootstrapPassword).Password
try {
  Write-Host 'Running Bicep what-if...' -ForegroundColor Cyan
  & az deployment group what-if `
    --resource-group $ResourceGroupName `
    --template-file $bicepPath `
    --parameters `
      environment=test `
      location=$Location `
      sqlEntraAdminLogin=$SqlEntraAdminLogin `
      sqlEntraAdminObjectId=$SqlEntraAdminObjectId `
      sqlBootstrapPassword=$plainPassword

  if ($LASTEXITCODE -ne 0) {
    throw 'Azure deployment what-if failed. No deployment was performed.'
  }

  Write-Host ''
  Write-Host 'WHAT-IF PASSED. Review the output above.' -ForegroundColor Green
  Write-Host 'No Bicep deployment has been executed by this script.' -ForegroundColor Yellow
  Write-Host ''
  Write-Host 'To deploy after explicit review/approval, run the same template with az deployment group create.' -ForegroundColor Cyan
}
finally {
  $plainPassword = $null
}

Write-Host 'No Odiscom LLC Azure resource or os.odiscom.com system was modified.' -ForegroundColor Green