param(
  [Parameter(Mandatory = $true)]
  [string]$TenantId,

  [string]$ExpectedDomain = 'odiscomsupply.com',

  [string]$ApiAppName = 'Odiscom Supply Internal API'
)

$ErrorActionPreference = 'Stop'

function Invoke-AzJson {
  param([string[]]$Arguments)
  $output = & az @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Azure CLI failed: az $($Arguments -join ' ')`n$output"
  }
  return ($output | Out-String).Trim()
}

$currentTenant = Invoke-AzJson @('account','show','--query','tenantId','-o','tsv')
if ($currentTenant.ToLowerInvariant() -ne $TenantId.ToLowerInvariant()) {
  throw "Refusing to continue. Authenticated tenant '$currentTenant' does not match '$TenantId'."
}

$domainJson = Invoke-AzJson @('rest','--method','GET','--url',"https://graph.microsoft.com/v1.0/domains/$ExpectedDomain",'--output','json')
$domain = $domainJson | ConvertFrom-Json
if (-not $domain.isVerified) {
  throw "Domain '$ExpectedDomain' is not verified in this tenant. Refusing to configure production Odiscom Supply app roles."
}

$escapedAppName = $ApiAppName.Replace("'", "''")
$appJson = Invoke-AzJson @('ad','app','list','--filter',"displayName eq '$escapedAppName'",'--query','[0]','--output','json')
$app = $appJson | ConvertFrom-Json
if (-not $app -or -not $app.id -or -not $app.appId) {
  throw "App registration '$ApiAppName' does not exist. Run bootstrap-entra-internal.ps1 first."
}

$roles = @(
  @{ Id = '8b73ba37-2b5f-4aa0-8499-3e90868464b1'; Value = 'Platform.Admin'; DisplayName = 'Platform Administrator'; Description = 'Full Odiscom Supply platform administration.' },
  @{ Id = 'd318e86e-3a32-41d6-ac70-3a19f43aaea0'; Value = 'Operations.User'; DisplayName = 'Operations'; Description = 'Broad Odiscom Supply internal operations access.' },
  @{ Id = 'fcbad122-2d82-4c27-8cba-8d821509db50'; Value = 'Sales.User'; DisplayName = 'Sales'; Description = 'Customer, quote, and sales-order workflows.' },
  @{ Id = '63b94966-1930-46f1-b60f-8951243710e1'; Value = 'Procurement.User'; DisplayName = 'Procurement'; Description = 'Supplier, sourcing, RFQ, offer, and catalog workflows.' },
  @{ Id = '3b211977-9360-4d6c-a4fe-8c1a5f7b6f0c'; Value = 'Fulfillment.User'; DisplayName = 'Fulfillment'; Description = 'Order fulfillment, shipment, and delivery workflows.' },
  @{ Id = 'da5b92d5-1885-4481-9104-27bbbd300ca6'; Value = 'Finance.User'; DisplayName = 'Finance'; Description = 'Finance-facing order and payment workflows.' },
  @{ Id = '6e4b662f-fb80-44ac-8f77-9e7f511ec23e'; Value = 'ReadOnly.User'; DisplayName = 'Read Only'; Description = 'Read-only internal access.' }
)

$appRoles = @()
foreach ($role in $roles) {
  $appRoles += @{
    allowedMemberTypes = @('User')
    description = $role.Description
    displayName = $role.DisplayName
    id = $role.Id
    isEnabled = $true
    origin = 'Application'
    value = $role.Value
  }
}

$patchBody = @{ appRoles = $appRoles } | ConvertTo-Json -Depth 10 -Compress
$tmpFile = [System.IO.Path]::GetTempFileName()
try {
  Set-Content -Path $tmpFile -Value $patchBody -Encoding UTF8 -NoNewline
  Invoke-AzJson @(
    'rest','--method','PATCH',
    '--url',"https://graph.microsoft.com/v1.0/applications/$($app.id)",
    '--headers','Content-Type=application/json',
    '--body',("@" + $tmpFile)
  ) | Out-Null
} finally {
  Remove-Item $tmpFile -ErrorAction SilentlyContinue
}

$spJson = Invoke-AzJson @('ad','sp','list','--filter',"appId eq '$($app.appId)'",'--query','[0]','--output','json')
$sp = $spJson | ConvertFrom-Json
if (-not $sp -or -not $sp.id) {
  throw 'Internal API service principal was not found.'
}

$assignments = @(
  @{ Group = 'OdiscomSupply-Platform-Admins'; Role = 'Platform.Admin' },
  @{ Group = 'OdiscomSupply-Operations'; Role = 'Operations.User' },
  @{ Group = 'OdiscomSupply-Sales'; Role = 'Sales.User' },
  @{ Group = 'OdiscomSupply-Procurement'; Role = 'Procurement.User' },
  @{ Group = 'OdiscomSupply-Fulfillment'; Role = 'Fulfillment.User' },
  @{ Group = 'OdiscomSupply-Finance'; Role = 'Finance.User' },
  @{ Group = 'OdiscomSupply-ReadOnly'; Role = 'ReadOnly.User' }
)

foreach ($assignment in $assignments) {
  $escapedGroup = $assignment.Group.Replace("'", "''")
  $groupId = Invoke-AzJson @('ad','group','list','--filter',"displayName eq '$escapedGroup'",'--query','[0].id','-o','tsv')
  if (-not $groupId) {
    throw "Required group '$($assignment.Group)' does not exist."
  }

  $role = $roles | Where-Object { $_.Value -eq $assignment.Role } | Select-Object -First 1
  $existingUrl = "https://graph.microsoft.com/v1.0/servicePrincipals/$($sp.id)/appRoleAssignedTo?`$filter=principalId eq $groupId and appRoleId eq $($role.Id)"
  $existingJson = Invoke-AzJson @('rest','--method','GET','--url',$existingUrl,'--output','json')
  $existing = $existingJson | ConvertFrom-Json

  if ($existing.value.Count -gt 0) {
    Write-Host "Role already assigned: $($assignment.Group) -> $($assignment.Role)" -ForegroundColor Gray
    continue
  }

  $body = @{
    principalId = $groupId
    resourceId = $sp.id
    appRoleId = $role.Id
  } | ConvertTo-Json -Compress

  $tmpAssignment = [System.IO.Path]::GetTempFileName()
  try {
    Set-Content -Path $tmpAssignment -Value $body -Encoding UTF8 -NoNewline
    Invoke-AzJson @(
      'rest','--method','POST',
      '--url',"https://graph.microsoft.com/v1.0/servicePrincipals/$($sp.id)/appRoleAssignedTo",
      '--headers','Content-Type=application/json',
      '--body',("@" + $tmpAssignment)
    ) | Out-Null
  } finally {
    Remove-Item $tmpAssignment -ErrorAction SilentlyContinue
  }

  Write-Host "Assigned: $($assignment.Group) -> $($assignment.Role)" -ForegroundColor Green
}

Write-Host ''
Write-Host 'Odiscom Supply Entra app roles are configured.' -ForegroundColor Green
Write-Host "Tenant: $TenantId" -ForegroundColor Yellow
Write-Host "API client ID: $($app.appId)" -ForegroundColor Yellow
Write-Host 'No Odiscom LLC app, group, tenant, SharePoint site, or os.odiscom.com resource was modified.' -ForegroundColor Green