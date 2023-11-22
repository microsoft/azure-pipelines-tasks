# Notation for Azure DevOps Task

Install Notation CLI, sign or verify container registry artifact. 

# Technical Design
The Notation ADO task calls upon the Notation CLI to execute signing and verification operations. Notation CLI is a tool used to sign and verify Docker container artifacts or images. When signing an artifact, Notation signs the artifact's unique manifest descriptor and attaches the signature to the same repository. When verifying an artifact, Notation retrieves the signature from the repository and validates it against the certificate in the trust store.

## notation install command
The command detects the current operating system and architecture to download the corresponding Notation CLI from GitHub releases. It also verifies the checksum of the downloaded file against the golden file in the `./data` folder and adds Notation to the PATH.

## notation sign command
This command downloads the selected Notation plugin, validates its checksum, and then calls on the Notation CLI to sign.

## notation verfy command
It transfers the trust store and trust policy from the user's code repository to the Notation configuration folder, as required by Notation CLI. It then invokes the Notation CLI to perform verification.

## Requirements
- public network access for downloading Notation CLI and Notation Azure Key Vault plugin from Github releases.
- Supported OS: Linux x64/ARM64, Windows x64, macOS x64/ARM64

# User Documents
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
