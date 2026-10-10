targetScope = 'resourceGroup'

@allowed([
  'dev'
  'test'
  'prod'
])
param environment string

param location string = resourceGroup().location
param workloadName string = 'odiscom-supply'

@description('Display name for the Microsoft Entra principal/group that administers Azure SQL.')
param sqlEntraAdminLogin string

@description('Object ID (SID) of the Microsoft Entra principal/group that administers Azure SQL.')
param sqlEntraAdminObjectId string

@description('Tenant ID that owns the Odiscom Supply Microsoft resources.')
param tenantId string = tenant().tenantId

@description('Bootstrap SQL login required by Azure SQL server creation. SQL authentication is disabled after the Entra-only control is applied.')
param sqlBootstrapLogin string = 'odiscomsupplybootstrap'

@secure()
@description('Bootstrap SQL password. Supply only from the deployment pipeline secret store; never commit it.')
param sqlBootstrapPassword string

@description('App Service plan SKU for the public/customer/supplier web application.')
param webPlanSku string = 'B1'

param tags object = {
  company: 'Odiscom Supply LLC'
  workload: workloadName
  environment: environment
  managedBy: 'Bicep'
}

var token = toLower(uniqueString(subscription().id, resourceGroup().id, environment))
var shortWorkload = 'odss'
var storageName = 'st${shortWorkload}${take(token, 12)}'
var keyVaultName = 'kv-${shortWorkload}-${take(token, 12)}'
var logName = 'log-${shortWorkload}-${environment}-${take(token, 6)}'
var appInsightsName = 'appi-${shortWorkload}-${environment}-${take(token, 6)}'
var sqlServerName = 'sql-${shortWorkload}-${environment}-${take(token, 8)}'
var sqlDatabaseName = 'OdiscomSupply'
var webPlanName = 'asp-${shortWorkload}-${environment}'
var webAppName = 'app-${shortWorkload}-${environment}-${take(token, 8)}'
var functionPlanName = 'fc-${shortWorkload}-${environment}-${take(token, 8)}'
var functionAppName = 'func-${shortWorkload}-${environment}-${take(token, 8)}'
var functionIdentityName = 'uai-${shortWorkload}-${environment}-functions'
var deploymentContainerName = 'function-packages'

var storageBlobDataOwnerRoleId = 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
var storageBlobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
var storageQueueDataContributorRoleId = '974c5e8b-45b9-4653-ba55-5f855dd0fb88'
var storageTableDataContributorRoleId = '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'
var monitoringMetricsPublisherRoleId = '3913510d-42f4-4e42-8a64-420c390055eb'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logName
  location: location
  tags: tags
  properties: {
    retentionInDays: 30
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    DisableLocalAuth: true
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  tags: tags
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }

  resource blobServices 'blobServices' = {
    name: 'default'
    properties: {
      deleteRetentionPolicy: {
        enabled: true
        days: 7
      }
    }

    resource functionPackages 'containers' = {
      name: deploymentContainerName
      properties: {
        publicAccess: 'None'
      }
    }

    resource uploads 'containers' = {
      name: 'application-uploads'
      properties: {
        publicAccess: 'None'
      }
    }
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2024-11-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    tenantId: tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enablePurgeProtection: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    publicNetworkAccess: 'Enabled'
  }
}

resource sqlServer 'Microsoft.Sql/servers@2023-08-01' = {
  name: sqlServerName
  location: location
  tags: tags
  properties: {
    administratorLogin: sqlBootstrapLogin
    administratorLoginPassword: sqlBootstrapPassword
    version: '12.0'
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    administrators: {
      administratorType: 'ActiveDirectory'
      azureADOnlyAuthentication: false
      login: sqlEntraAdminLogin
      principalType: 'Group'
      sid: sqlEntraAdminObjectId
      tenantId: tenantId
    }
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-08-01' = {
  parent: sqlServer
  name: sqlDatabaseName
  location: location
  tags: tags
  sku: {
    name: 'GP_S_Gen5_1'
    tier: 'GeneralPurpose'
    family: 'Gen5'
    capacity: 1
  }
  properties: {
    autoPauseDelay: 60
    minCapacity: json('0.5')
    zoneRedundant: false
    readScale: 'Disabled'
  }
}

resource sqlEntraOnly 'Microsoft.Sql/servers/azureADOnlyAuthentications@2023-08-01' = {
  parent: sqlServer
  name: 'Default'
  properties: {
    azureADOnlyAuthentication: true
  }
  dependsOn: [
    sqlDatabase
  ]
}

resource functionIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: functionIdentityName
  location: location
  tags: tags
}

resource functionStorageBlobOwner 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, functionIdentity.id, storageBlobDataOwnerRoleId)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataOwnerRoleId)
    principalId: functionIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource functionStorageBlobContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, functionIdentity.id, storageBlobDataContributorRoleId)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
    principalId: functionIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource functionStorageQueueContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, functionIdentity.id, storageQueueDataContributorRoleId)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageQueueDataContributorRoleId)
    principalId: functionIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource functionStorageTableContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, functionIdentity.id, storageTableDataContributorRoleId)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageTableDataContributorRoleId)
    principalId: functionIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource functionMetricsPublisher 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(applicationInsights.id, functionIdentity.id, monitoringMetricsPublisherRoleId)
  scope: applicationInsights
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', monitoringMetricsPublisherRoleId)
    principalId: functionIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource functionKeyVaultReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, functionIdentity.id, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: functionIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource functionPlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: functionPlanName
  location: location
  kind: 'functionapp'
  tags: tags
  sku: {
    tier: 'FlexConsumption'
    name: 'FC1'
  }
  properties: {
    reserved: true
  }
}

resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${functionIdentity.id}': {}
    }
  }
  properties: {
    serverFarmId: functionPlan.id
    httpsOnly: true
    siteConfig: {
      minTlsVersion: '1.2'
    }
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.properties.primaryEndpoints.blob}${deploymentContainerName}'
          authentication: {
            type: 'UserAssignedIdentity'
            userAssignedIdentityResourceId: functionIdentity.id
          }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: 100
        instanceMemoryMB: 2048
      }
      runtime: {
        name: 'node'
        version: '22'
      }
    }
  }

  resource appSettings 'config' = {
    name: 'appsettings'
    properties: {
      AzureWebJobsStorage__accountName: storage.name
      AzureWebJobsStorage__credential: 'managedidentity'
      AzureWebJobsStorage__clientId: functionIdentity.properties.clientId
      APPLICATIONINSIGHTS_CONNECTION_STRING: applicationInsights.properties.ConnectionString
      APPLICATIONINSIGHTS_AUTHENTICATION_STRING: 'ClientId=${functionIdentity.properties.clientId};Authorization=AAD'
      AZURE_CLIENT_ID: functionIdentity.properties.clientId
      KEY_VAULT_URI: keyVault.properties.vaultUri
      SQL_SERVER_FQDN: sqlServer.properties.fullyQualifiedDomainName
      SQL_DATABASE_NAME: sqlDatabase.name
      ODISCOM_SUPPLY_ENVIRONMENT: environment
    }
  }
}

resource webPlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: webPlanName
  location: location
  kind: 'linux'
  tags: tags
  sku: {
    name: webPlanSku
  }
  properties: {
    reserved: true
  }
}

resource webApp 'Microsoft.Web/sites@2024-04-01' = {
  name: webAppName
  location: location
  kind: 'app,linux'
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: webPlan.id
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      alwaysOn: webPlanSku != 'F1'
      appSettings: [
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: applicationInsights.properties.ConnectionString
        }
        {
          name: 'KEY_VAULT_URI'
          value: keyVault.properties.vaultUri
        }
        {
          name: 'SQL_SERVER_FQDN'
          value: sqlServer.properties.fullyQualifiedDomainName
        }
        {
          name: 'SQL_DATABASE_NAME'
          value: sqlDatabase.name
        }
        {
          name: 'ODISCOM_SUPPLY_ENVIRONMENT'
          value: environment
        }
      ]
    }
  }
}

resource webKeyVaultReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, webApp.id, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output webAppName string = webApp.name
output webAppHostName string = webApp.properties.defaultHostName
output functionAppName string = functionApp.name
output keyVaultName string = keyVault.name
output storageAccountName string = storage.name
output sqlServerName string = sqlServer.name
output sqlDatabaseName string = sqlDatabase.name
output applicationInsightsName string = applicationInsights.name
output functionManagedIdentityClientId string = functionIdentity.properties.clientId
