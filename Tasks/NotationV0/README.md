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

## Bump up notation version
1. Run ./scripts/generate_checksum.py to update the ./data/notation_versions.json file.
2. Update the task.json and task.loc.json default version to be the latest version.
