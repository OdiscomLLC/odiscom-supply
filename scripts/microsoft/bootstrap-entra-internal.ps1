param(
  [Parameter(Mandatory = $true)]
  [string]$TenantId,

  [string]$ExpectedDomain = 'odiscomsupply.com',

  [string]$InternalApiAppName = 'Odiscom Supply Internal API'
)

$ErrorActionPreference = 'Stop'

function Invoke-AzTsv {
  param([string[]]$Arguments)
  $result = & az @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Azure CLI failed: az $($Arguments -join ' ')`n$result"
  }
  return ($result | Out-String).Trim()
}

Write-Host 'Validating authenticated Microsoft tenant...' -ForegroundColor Cyan
$currentTenant = Invoke-AzTsv @('account','show','--query','tenantId','-o','tsv')

if (-not $currentTenant) {
  throw 'No authenticated Azure tenant was found. Sign in to the Odiscom Supply tenant first.'
}

if ($currentTenant.ToLowerInvariant() -ne $TenantId.ToLowerInvariant()) {
  throw "Refusing to continue. Authenticated tenant '$currentTenant' does not match requested Odiscom Supply tenant '$TenantId'."
}

Write-Host "Authenticated tenant matches $TenantId." -ForegroundColor Green
Write-Host "Verifying custom domain $ExpectedDomain..." -ForegroundColor Cyan

$domainJson = & az rest `
  --method GET `
  --url "https://graph.microsoft.com/v1.0/domains/$ExpectedDomain" `
  --output json 2>&1

if ($LASTEXITCODE -ne 0) {
  throw "Domain '$ExpectedDomain' was not found in the authenticated tenant. Do not run Odiscom Supply bootstrap against another company's tenant."
}

$domain = $domainJson | ConvertFrom-Json
if (-not $domain.isVerified) {
  throw "Domain '$ExpectedDomain' exists but is not verified. Verify it before provisioning Odiscom Supply identities."
}

Write-Host "Verified Odiscom Supply domain: $ExpectedDomain" -ForegroundColor Green

$groups = @(
  @{ DisplayName = 'OdiscomSupply-Platform-Admins'; MailNickname = 'odiscomsupply-platform-admins' },
  @{ DisplayName = 'OdiscomSupply-Operations'; MailNickname = 'odiscomsupply-operations' },
  @{ DisplayName = 'OdiscomSupply-Sales'; MailNickname = 'odiscomsupply-sales' },
  @{ DisplayName = 'OdiscomSupply-Procurement'; MailNickname = 'odiscomsupply-procurement' },
  @{ DisplayName = 'OdiscomSupply-Fulfillment'; MailNickname = 'odiscomsupply-fulfillment' },
  @{ DisplayName = 'OdiscomSupply-Finance'; MailNickname = 'odiscomsupply-finance' },
  @{ DisplayName = 'OdiscomSupply-ReadOnly'; MailNickname = 'odiscomsupply-readonly' }
)

$groupResults = @()

foreach ($group in $groups) {
  $escapedDisplayName = $group.DisplayName.Replace("'", "''")
  $existingId = Invoke-AzTsv @(
    'ad','group','list',
    '--filter',"displayName eq '$escapedDisplayName'",
    '--query','[0].id',
    '-o','tsv'
  )

  if ($existingId) {
    Write-Host "Group exists: $($group.DisplayName)" -ForegroundColor Gray
    $groupId = $existingId
  } else {
    Write-Host "Creating group: $($group.DisplayName)" -ForegroundColor Cyan
    $groupId = Invoke-AzTsv @(
      'ad','group','create',
      '--display-name',$group.DisplayName,
      '--mail-nickname',$group.MailNickname,
      '--query','id',
      '-o','tsv'
    )
  }

  $groupResults += [pscustomobject]@{
    DisplayName = $group.DisplayName
    ObjectId = $groupId
  }
}

Write-Host 'Ensuring internal API app registration exists...' -ForegroundColor Cyan
$escapedAppName = $InternalApiAppName.Replace("'", "''")
$appJson = & az ad app list `
  --filter "displayName eq '$escapedAppName'" `
  --query '[0]' `
  --output json 2>&1

if ($LASTEXITCODE -ne 0) {
  throw "Unable to query Entra applications: $appJson"
}

$app = $appJson | ConvertFrom-Json

if (-not $app) {
  $appJson = & az ad app create `
    --display-name $InternalApiAppName `
    --sign-in-audience AzureADMyOrg `
    --output json 2>&1

  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create internal API app registration: $appJson"
  }

  $app = $appJson | ConvertFrom-Json
  Write-Host "Created app registration: $InternalApiAppName" -ForegroundColor Green
} else {
  Write-Host "App registration exists: $InternalApiAppName" -ForegroundColor Gray
}

$clientId = $app.appId
$objectId = $app.id

if (-not $clientId -or -not $objectId) {
  throw 'Internal API app registration did not return expected IDs.'
}

$servicePrincipalId = Invoke-AzTsv @(
  'ad','sp','list',
  '--filter',"appId eq '$clientId'",
  '--query','[0].id',
  '-o','tsv'
)

if (-not $servicePrincipalId) {
  $servicePrincipalId = Invoke-AzTsv @(
    'ad','sp','create',
    '--id',$clientId,
    '--query','id',
    '-o','tsv'
  )
  Write-Host 'Created service principal for internal API.' -ForegroundColor Green
}

Write-Host ''
Write-Host 'Odiscom Supply internal identity bootstrap is ready.' -ForegroundColor Green
Write-Host "Tenant ID: $TenantId" -ForegroundColor Yellow
Write-Host "Verified domain: $ExpectedDomain" -ForegroundColor Yellow
Write-Host "Internal API client ID: $clientId" -ForegroundColor Yellow
Write-Host "Internal API object ID: $objectId" -ForegroundColor Yellow
Write-Host "Internal API service principal ID: $servicePrincipalId" -ForegroundColor Yellow
Write-Host ''
Write-Host 'Security groups:' -ForegroundColor Yellow
$groupResults | Format-Table -AutoSize

Write-Host ''
Write-Host 'No Odiscom LLC groups, SharePoint sites, app registrations, or os.odiscom.com resources were touched.' -ForegroundColor Green
Write-Host 'Next gate: configure API scopes/app roles and create the Odiscom Supply SharePoint site in this same verified tenant.' -ForegroundColor Cyan
