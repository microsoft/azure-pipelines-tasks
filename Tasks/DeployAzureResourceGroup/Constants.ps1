$winrmHttpListner = "{
                          ""Listeners"": [
                            {
                              ""protocol"": ""http""
                            }
                          ]
                     }"

$winrmHttpsListner = "{
                          ""Listeners"": [
                            {
                              ""protocol"": ""https"",
                              ""certificateUrl"": ""$azureKeyVaultSecretId""
                            }
                          ]
                     }"

$winrmBothListners = "{
                          ""Listeners"": [
                            {
                              ""protocol"": ""https"",
                              ""certificateUrl"": ""$azureKeyVaultSecretId""
                            },
                            {
                              ""protocol"": ""http""
                            }
                          ]
                     }"

$secrets = "{
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