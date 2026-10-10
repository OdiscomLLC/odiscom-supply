param(
  [Parameter(Mandatory = $true)]
  [string]$OrganizationUrl,

  [Parameter(Mandatory = $true)]
  [string]$ProjectName,

  [string]$RepositoryName = 'odiscom-supply',

  [string]$SourceRepository = 'https://github.com/OdiscomLLC/odiscom-supply.git'
)

$ErrorActionPreference = 'Stop'

function Invoke-Cli {
  param(
    [string]$Command,
    [string[]]$Arguments
  )
  $output = & $Command @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "$Command $($Arguments -join ' ') failed.`n$output"
  }
  return ($output | Out-String).Trim()
}

if ($OrganizationUrl -notmatch '^https://dev\.azure\.com/[^/]+/?$') {
  throw 'OrganizationUrl must look like https://dev.azure.com/<organization>.'
}

$gitVersion = Invoke-Cli -Command 'git' -Arguments @('--version')
Write-Host $gitVersion -ForegroundColor Gray

Invoke-Cli -Command 'az' -Arguments @('--version') | Out-Null
Write-Host 'Azure CLI detected.' -ForegroundColor Gray

$extensionJson = Invoke-Cli -Command 'az' -Arguments @('extension','list','--query',"[?name=='azure-devops']",'--output','json')
$extension = $extensionJson | ConvertFrom-Json
if (-not $extension -or $extension.Count -eq 0) {
  throw 'Azure DevOps CLI extension is required. Install it with: az extension add --name azure-devops'
}

Invoke-Cli -Command 'az' -Arguments @('devops','configure','--defaults',"organization=$OrganizationUrl","project=$ProjectName") | Out-Null

$projectJson = Invoke-Cli -Command 'az' -Arguments @('devops','project','show','--project',$ProjectName,'--output','json')
$project = $projectJson | ConvertFrom-Json
if (-not $project.id) {
  throw "Azure DevOps project '$ProjectName' could not be resolved."
}

$repo = $null
try {
  $repoJson = Invoke-Cli -Command 'az' -Arguments @('repos','show','--repository',$RepositoryName,'--project',$ProjectName,'--output','json')
  if ($repoJson) { $repo = $repoJson | ConvertFrom-Json }
} catch {
  $repo = $null
}

if (-not $repo -or -not $repo.id) {
  Write-Host "Creating Azure DevOps repository: $RepositoryName" -ForegroundColor Cyan
  $repoJson = Invoke-Cli -Command 'az' -Arguments @('repos','create','--name',$RepositoryName,'--project',$ProjectName,'--output','json')
  $repo = $repoJson | ConvertFrom-Json
}

if (-not $repo.remoteUrl) {
  throw 'Azure DevOps repository did not return a remote URL.'
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('odiscom-supply-mirror-' + [guid]::NewGuid().ToString('N'))
$mirrorPath = Join-Path $tempRoot 'odiscom-supply.git'

New-Item -ItemType Directory -Path $tempRoot | Out-Null

try {
  Write-Host 'Cloning GitHub repository as a mirror...' -ForegroundColor Cyan
  Invoke-Cli -Command 'git' -Arguments @('clone','--mirror',$SourceRepository,$mirrorPath) | Out-Null

  Push-Location $mirrorPath
  try {
    Write-Host 'Adding Azure DevOps destination...' -ForegroundColor Cyan
    Invoke-Cli -Command 'git' -Arguments @('remote','add','azure',$repo.remoteUrl) | Out-Null

    Write-Host 'Pushing all refs to Azure DevOps...' -ForegroundColor Cyan
    Invoke-Cli -Command 'git' -Arguments @('push','--mirror','azure') | Out-Null
  }
  finally {
    Pop-Location
  }
}
finally {
  Remove-Item -Path $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host 'Azure DevOps mirror migration completed.' -ForegroundColor Green
Write-Host "Project: $ProjectName" -ForegroundColor Yellow
Write-Host "Repository: $RepositoryName" -ForegroundColor Yellow
Write-Host "Destination: $($repo.remoteUrl)" -ForegroundColor Yellow
Write-Host ''
Write-Host 'This script does not archive or delete the GitHub repository.' -ForegroundColor Green
Write-Host 'Do not retire GitHub until Azure DevOps pipelines and rollback are validated.' -ForegroundColor Cyan