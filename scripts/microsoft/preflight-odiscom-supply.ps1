param(
  [Parameter(Mandatory = $true)]
  [string]$TenantId,

  [string]$ExpectedDomain = 'odiscomsupply.com',

  [string]$ExpectedTenantDisplayName = 'Odiscom Supply LLC'
)

$ErrorActionPreference = 'Stop'

function Invoke-Az {
  param([string[]]$Arguments)
  $output = & az @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Azure CLI failed: az $($Arguments -join ' ')`n$output"
  }
  return ($output | Out-String).Trim()
}

$accountJson = Invoke-Az @('account','show','--output','json')
$account = $accountJson | ConvertFrom-Json

if (-not $account.tenantId) {
  throw 'Azure CLI is not authenticated.'
}

if ($account.tenantId.ToLowerInvariant() -ne $TenantId.ToLowerInvariant()) {
  throw "Wrong tenant. Authenticated tenant '$($account.tenantId)' does not match Odiscom Supply tenant '$TenantId'."
}

$organizationJson = Invoke-Az @('rest','--method','GET','--url','https://graph.microsoft.com/v1.0/organization?$select=id,displayName,verifiedDomains','--output','json')
$organizationResponse = $organizationJson | ConvertFrom-Json
$organization = $organizationResponse.value | Select-Object -First 1

if (-not $organization) {
  throw 'Microsoft Graph did not return an organization record.'
}

if ($organization.id.ToLowerInvariant() -ne $TenantId.ToLowerInvariant()) {
  throw "Graph organization ID '$($organization.id)' does not match requested tenant '$TenantId'."
}

if ($organization.displayName -ne $ExpectedTenantDisplayName) {
  throw "Tenant display name '$($organization.displayName)' does not match expected '$ExpectedTenantDisplayName'."
}

$domain = $organization.verifiedDomains | Where-Object { $_.name -eq $ExpectedDomain } | Select-Object -First 1

$domainStatus = if ($domain) {
  [pscustomobject]@{
    name = $domain.name
    isDefault = [bool]$domain.isDefault
    isInitial = [bool]$domain.isInitial
    isVerified = $true
  }
} else {
  [pscustomobject]@{
    name = $ExpectedDomain
    isDefault = $false
    isInitial = $false
    isVerified = $false
  }
}

$subscriptionsJson = Invoke-Az @('account','list','--all','--output','json')
$subscriptions = ($subscriptionsJson | ConvertFrom-Json) | Where-Object { $_.tenantId -eq $TenantId }

$result = [pscustomobject]@{
  checkedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
  tenant = [pscustomobject]@{
    id = $organization.id
    displayName = $organization.displayName
    expectedDomain = $ExpectedDomain
    domain = $domainStatus
  }
  signedInAccount = [pscustomobject]@{
    user = $account.user.name
    type = $account.user.type
  }
  subscriptions = @($subscriptions | ForEach-Object {
    [pscustomobject]@{
      id = $_.id
      name = $_.name
      state = $_.state
      isDefault = [bool]$_.isDefault
    }
  })
}

$result | ConvertTo-Json -Depth 8

if (-not $domainStatus.isVerified) {
  Write-Error "Preflight blocked: '$ExpectedDomain' is not yet verified in Microsoft Entra."
  exit 2
}

Write-Host ''
Write-Host 'Odiscom Supply Microsoft preflight PASSED.' -ForegroundColor Green
Write-Host "Tenant: $($organization.displayName) ($($organization.id))" -ForegroundColor Yellow
Write-Host "Verified domain: $ExpectedDomain" -ForegroundColor Yellow

if (@($subscriptions).Count -eq 0) {
  Write-Warning 'No Azure subscription is currently visible in the Odiscom Supply tenant. Identity provisioning can continue, but Azure deployment cannot.'
} else {
  Write-Host "Azure subscriptions visible: $(@($subscriptions).Count)" -ForegroundColor Yellow
}

Write-Host 'No Odiscom LLC resource was changed by this preflight.' -ForegroundColor Green