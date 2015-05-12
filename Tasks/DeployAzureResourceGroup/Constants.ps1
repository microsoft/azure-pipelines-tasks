$winrmHttpListenerJson = "{
                          ""Listeners"": [
                            {
                              ""protocol"": ""http""
                            }
                          ]
                     }"

$winrmHttpsListenerJson = "{
                          ""Listeners"": [
                            {
                              ""protocol"": ""https"",
                              ""certificateUrl"": ""$azureKeyVaultSecretId""
                            }
                          ]
                     }"

$secretsJson = "{
                ""sourceVault"": {
                    ""id"": ""[resourceId('$resourceGroupName', 'Microsoft.KeyVault/vaults', '$azureKeyVaultName')]""
                  },
                  ""vaultCertificates"": [
                    {
                      ""certificateUrl"": ""$azureKeyVaultSecretId"",
                      ""certificateStore"": ""My""
                    }
                  ]
           }"

$winRmHttps = "winrmhttps"
$winRmHttp = "winrmhttp"
$none = "none"
$secretsNode = "secrets"
$pfxCertificateType = "pfx"
$osProfile = "properties.osProfile"
$windowsConfigurationNode = "windowsConfiguration"
$winRM = "winRM"
$provisionVMAgent = "provisionVMAgent"
$enableAutomaticUpdates = "enableAutomaticUpdates"
$virtualMachineType = "Microsoft.Compute/virtualMachines"
$resources = "resources"
$type = "type"