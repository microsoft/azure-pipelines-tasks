param location string = 'eastasia'
param unusedParam string = 'test'

var storageAccountName_var = 'deepak2121'
var storageAccountType = 'Premium_LRS'

resource storageAccount 'Microsoft.Storage/storageAccounts@2021-01-01' = {
  name: toLower(take(storageAccountName_var, 24))
  location: location
  sku: {
    name: storageAccountType
  }
  kind: 'StorageV2'
}

output storageAccount_Name string = storageAccount.name
output storageAccount_Location string = storageAccount.location
output storageAccount_SKUName string = storageAccount.sku.name
output storageAccount_Kind string = storageAccount.kind