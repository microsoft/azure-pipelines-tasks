# Notation for Azure DevOps Task

Install Notation CLI, sign or verify container registry artifact. The Notation ADO task invokes Notation CLI to run the signing and verification operations.

## Usage
- [Notation sign on ADO pipeline](./docs/sign-images-pipeline.md)

## Inputs
`command` - Command  
`string`. Required. Allowed values: `install`, `sign` and `verify`.

`artifactRefs` - Artifact References  
`string`. The container artifact reference with digest. If multiple references are used, please use comma to separate them. If it was not specified, the task will automatically detect it from previous Docker task.

`plugin` - Plugin  
`string`. Required for sign command. Allowed values: `azureKeyVault`.

`akvPluginVersion` - Azure Key Vault Plugin Version
`string`. Required for `azureKeyVault` plugin. The version for Azure Key Vault plugin. Please visit the [release page](https://github.com/Azure/notation-azure-kv/releases) to choose a released version.

`azurekvServiceConnection` - Azure Key Vault Service Connection  
`string`. Required for `azure-kv` plugin. Select the The Azure Resource Manager service connection for the key vault if prefer to use service connection for authentication.

`keyid` - Key ID  
`string`. Required for `azure-kv` plugin. The key identifier of an Azure Key Vault certificate.

`selfSigned` - Self signed  
`boolean`. Whether the certficate is self-signed certificate.

`caCertBundle` - Certificate Bundle File Path  
`string`. The certificate bundle file containing intermidiate certificates and root certificate.

`trustPolicy` - Trust Policy File Path  
`string`. Required for `verify` command. The trust policy file path.

`trustStore` - Trust Store Folder Path  
`string`. Requried for `verify` command. The trust store folder path.

`signatureFormat` - Signature Format  
`string`. Signature envelope format. Allowed values: `jws`, `cose`.

`allowReferrersAPI` - [Experimental] Allow Referrers API  
`boolean`. Use the Referrers API to sign signatures, if not supported (returns 404), fallback to the Referrers tag schema.
