param input string

resource sa 'Microsoft.Storage/storageAccounts@2019-06-01' = {
  name: input
  location: resourceGroup().location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
}
