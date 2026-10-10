import { DefaultAzureCredential } from '@azure/identity'
import { SecretClient } from '@azure/keyvault-secrets'

let client

function getClient() {
  const vaultUri = process.env.KEY_VAULT_URI
  if (!vaultUri) throw new Error('KEY_VAULT_URI is not configured.')
  if (!client) client = new SecretClient(vaultUri, new DefaultAzureCredential())
  return client
}

async function getSecret(name, envName) {
  if (process.env[envName]) return process.env[envName]
  const result = await getClient().getSecret(name)
  if (!result?.value) throw new Error(`Key Vault secret ${name} is empty or unavailable.`)
  return result.value
}

export async function loadSupplierSecrets(supplier) {
  if (supplier === 'digikey') {
    const [clientId, clientSecret] = await Promise.all([
      getSecret('digikey-client-id', 'DIGIKEY_CLIENT_ID'),
      getSecret('digikey-client-secret', 'DIGIKEY_CLIENT_SECRET'),
    ])

    let accountId = process.env.DIGIKEY_ACCOUNT_ID || null
    if (!accountId && process.env.KEY_VAULT_URI) {
      try {
        accountId = (await getClient().getSecret('digikey-account-id'))?.value || null
      } catch {
        accountId = null
      }
    }

    return { clientId, clientSecret, accountId }
  }

  if (supplier === 'mouser') {
    return {
      apiKey: await getSecret('mouser-api-key', 'MOUSER_API_KEY'),
    }
  }

  throw new Error(`Unsupported supplier connector: ${supplier}`)
}
