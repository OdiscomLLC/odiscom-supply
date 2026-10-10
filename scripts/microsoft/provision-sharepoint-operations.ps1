param(
  [Parameter(Mandatory = $true)]
  [string]$TenantId,

  [Parameter(Mandatory = $true)]
  [string]$TenantAdminUrl,

  [string]$ExpectedDomain = 'odiscomsupply.com',
  [string]$SiteTitle = 'Odiscom Supply Operations',
  [string]$SiteAlias = 'OdiscomSupplyOperations'
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

Write-Host 'Running Odiscom Supply tenant guard...' -ForegroundColor Cyan

$currentTenant = Invoke-AzText @('account','show','--query','tenantId','-o','tsv')
if ($currentTenant.ToLowerInvariant() -ne $TenantId.ToLowerInvariant()) {
  throw "Refusing to continue. Authenticated tenant '$currentTenant' does not match Odiscom Supply tenant '$TenantId'."
}

$organizationJson = Invoke-AzText @(
  'rest','--method','GET',
  '--url','https://graph.microsoft.com/v1.0/organization?$select=id,displayName,verifiedDomains',
  '--output','json'
)
$organization = (($organizationJson | ConvertFrom-Json).value | Select-Object -First 1)

if (-not $organization) { throw 'Microsoft Graph did not return an organization record.' }
if ($organization.id.ToLowerInvariant() -ne $TenantId.ToLowerInvariant()) {
  throw 'Graph tenant ID does not match the requested Odiscom Supply tenant.'
}
if ($organization.displayName -ne 'Odiscom Supply LLC') {
  throw "Unexpected tenant display name '$($organization.displayName)'. Refusing to create SharePoint resources."
}

$verifiedDomain = $organization.verifiedDomains | Where-Object { $_.name -eq $ExpectedDomain } | Select-Object -First 1
if (-not $verifiedDomain) {
  throw "Custom domain '$ExpectedDomain' is not verified. Refusing to provision SharePoint."
}

if ($TenantAdminUrl -notmatch '^https://[^/]+-admin\.sharepoint\.com/?$') {
  throw 'TenantAdminUrl must be the Odiscom Supply SharePoint admin URL, such as https://tenant-admin.sharepoint.com.'
}

if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
  throw 'PnP.PowerShell is required. Install it on the administrator workstation before running this script.'
}

Import-Module PnP.PowerShell

Write-Host "Connecting to $TenantAdminUrl..." -ForegroundColor Cyan
Connect-PnPOnline -Url $TenantAdminUrl -Interactive -Tenant $TenantId

$existing = Get-PnPTenantSite -Detailed -IncludeOneDriveSites:$false |
  Where-Object { $_.Title -eq $SiteTitle -or $_.Url -match "/sites/$SiteAlias$" } |
  Select-Object -First 1

if (-not $existing) {
  Write-Host "Creating private team site: $SiteTitle" -ForegroundColor Cyan
  $created = New-PnPSite -Type TeamSite -Title $SiteTitle -Alias $SiteAlias -IsPublic:$false -Wait
  $siteUrl = $created
} else {
  Write-Host "Site already exists: $($existing.Url)" -ForegroundColor Gray
  $siteUrl = $existing.Url
}

if (-not $siteUrl) { throw 'SharePoint site URL was not returned.' }

Write-Host "Connecting to site $siteUrl..." -ForegroundColor Cyan
Connect-PnPOnline -Url $siteUrl -Interactive -Tenant $TenantId

$libraries = @(
  @{ Title = 'Operations Documents'; Description = 'Odiscom Supply internal procedures, templates, runbooks, and operating records.' },
  @{ Title = 'Customer Records'; Description = 'Governed Odiscom Supply customer documents.' },
  @{ Title = 'Supplier Records'; Description = 'Governed Odiscom Supply supplier records, agreements, and evidence.' },
  @{ Title = 'Procurement Evidence'; Description = 'BOMs, supplier quotes, compliance evidence, and sourcing artifacts.' },
  @{ Title = 'Sales Orders and Fulfillment'; Description = 'Quote/order artifacts, packing, shipping, and fulfillment records.' }
)

foreach ($library in $libraries) {
  $list = Get-PnPList -Identity $library.Title -ErrorAction SilentlyContinue
  if ($list) {
    Write-Host "Library exists: $($library.Title)" -ForegroundColor Gray
    continue
  }

  Add-PnPList -Title $library.Title -Template DocumentLibrary -OnQuickLaunch:$false | Out-Null
  Set-PnPList -Identity $library.Title -EnableVersioning:$true -MajorVersions 100 -EnableMinorVersions:$false
  Set-PnPList -Identity $library.Title -Description $library.Description
  Write-Host "Created library: $($library.Title)" -ForegroundColor Green
}

$lists = @(
  @{ Title = 'Review Queue'; Description = 'Internal review/approval queue for Odiscom Supply operations.' },
  @{ Title = 'Exception Queue'; Description = 'Operational exceptions that require internal follow-up.' },
  @{ Title = 'Process Checklists'; Description = 'Repeatable Odiscom Supply process checklists and completion state.' }
)

foreach ($listSpec in $lists) {
  $list = Get-PnPList -Identity $listSpec.Title -ErrorAction SilentlyContinue
  if ($list) {
    Write-Host "List exists: $($listSpec.Title)" -ForegroundColor Gray
    continue
  }

  Add-PnPList -Title $listSpec.Title -Template GenericList -OnQuickLaunch:$false | Out-Null
  Set-PnPList -Identity $listSpec.Title -Description $listSpec.Description
  Write-Host "Created list: $($listSpec.Title)" -ForegroundColor Green
}

Write-Host ''
Write-Host 'Odiscom Supply SharePoint internal foundation is ready.' -ForegroundColor Green
Write-Host "Site: $siteUrl" -ForegroundColor Yellow
Write-Host 'External customers and suppliers have not been granted site membership.' -ForegroundColor Green
Write-Host 'No Odiscom LLC SharePoint site or os.odiscom.com resource was modified.' -ForegroundColor Green