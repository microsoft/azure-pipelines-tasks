param input string

// This will fail at deploy time, because the resource doesn't exist
resource sa 'Microsoft.Storage/storageAccounts@2019-06-01' existing = {
  name: input
}

output accessTier string = sa.properties.accessTier
