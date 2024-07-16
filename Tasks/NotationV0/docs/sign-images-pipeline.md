# Notation sign task for Azure DevOps pipeline

This document walks you through how to create an Azure pipeline to achieve the following goals:

1. Build a container image and push it to Azure Container Registry (ACR).
2. Install Notation CLI, sign the image with Notation and Notation AKV plugin. The generated signature will be automatically pushed to ACR.

## Prerequisites

- You have created a Key Vault in Azure Key Vault and created a self-signed signing key and certificate. You can follow this [doc](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-tutorial-sign-build-push#create-a-self-signed-certificate-azure-cli) to create self-signed key and certificate for testing purposes. If you have a CA issued certificate, see this doc for details.
- You have created a registry in ACR.
- You have an Azure DevOps repository or GitHub repository.

## Create Service Connection

Signing an image stored in ACR registry requires the ACR credential. Use the [Docker task](https://learn.microsoft.com/en-us/azure/devops/pipelines/tasks/reference/docker-v2?view=azure-pipelines&tabs=yaml#build-and-push) to log in to the ACR registry. 

Create a [Docker Registry service connection](https://learn.microsoft.com/azure/devops/pipelines/library/service-endpoints?view=azure-devops&tabs=yaml#docker-registry-service-connection) in Azure DevOps pipeline to grant the access permission to your ACR registry for the Notation tasks. 

- Sign in to your organization (`https://dev.azure.com/{yourorganization}`) and select your project.
- Select the **Settings** button in the bottom-left corner.
- Go to **Pipelines**, and then select **Service connection**.
- Choose **New service connection** and select **Docker Registry**.
- Next choose **Azure Container Registry**.
- Choose **Service Principle** in the **Authentication Type** and enter the Service Principal details including your Azure Subscription and ACR registry.
- Enter a user-friendly **Connection name** to use when referring to this service connection.

Similarly, Create a service connection with the connection type of [Azure Resource Manager](https://learn.microsoft.com/azure/devops/pipelines/library/service-endpoints?view=azure-devops&tabs=yaml#azure-resource-manager-service-connection). This will grant the access to your Azure Key Vault:

- Choose **Service principal (automatic)**.
- Next, choose **Subscription** and find your Azure subscription from the drop-down list.
- Choose an available Resource group from the drop-down list.
- Enter a user-friendly **Service connection name** to use when referring to this service connection.
- Save it to finish the creation.

Grant the access policy to your service principal.

- Open the created Azure Resource Manager service connection and click **Manage Service Principal** to enter the Azure service principal portal.
- Copy the `Application (client) ID`. It will be used to grant the permission for the service principal.
- Open the Azure Key Vault portal and enter **Access Policies** page.
- Create a new access policy with `key sign`, `secret get` and `certificate get` permission.
- Grant this new access policy to a service principle using the `Application (client) ID` paste from the previous step.
- Save it to finish the creation.

See [this doc](https://learn.microsoft.com/en-us/azure/devops/pipelines/library/service-endpoints?view=azure-devops&tabs=yaml#create-a-service-connection) for more details.

## Create a pipeline and use Notation task

Create an Azure pipeline for your git repository as follows:

- Navigate to the project in your AOD organization.
- Go to **Pipelines** from the left menu and then select **New pipeline**. 
- Choose your git repository. We use the Azure DevOps repository for demonstration convenience.
- Configure the pipeline with a **Starter Pipeline** if you are new to Azure DevOps. Review and create the pipeline by clicking on **Save and run**.

> [!NOTE]
> The example assumes that the default branch is `main`. If it's not, please follow the [guide](https://learn.microsoft.com/azure/devops/repos/git/change-default-branch?view=azure-devops#temporary-mirroring) to update the default branch.

Edit the pipeline created in the previous step. There are two ways to use Notation tasks to sign images in your Azure pipeline: use the ADO panel to add Notation tasks to your pipeline or copy from the sample Azure Pipeline file from the option 2 below.

### Option 1: Using editing panel

Search the `Docker` task from the pipeline editing panel on the right side. We use its `login` command with the Docker Registry service connection to authenticate with ACR.

- Choose the Docker Registry service connection created in the previous step from the **Container registry** drop-down list. Click **Add** to add the `notation install` task to the pipeline. 
- Choose `login` from the **Command** drop-down list.
- Click **Add** to add the `notation sign` to the pipeline file left.

Similarly, search the `Docker` task from the pipeline editing panel again. We use its `buildAndPush` command to automatically build the source code to an image and push it to the target ACR repository. It will generate an image digest that will be used for signing in the next step. 

- Input the repository name to **Container repository**.
- Choose **buildAndPush** from the the **Command** drop-down list.
- Specify the file path of Dockerfile. For example, use `./Dockerfile` if your Dockerfile is stored in the root folder.
- Click **Add** to add the `notation sign` to the pipeline file left.

Search the `Notation` task from the pipeline editing panel on the right side. 

- Choose **Install** from the drop-down list **command to run**. Click **Add** to add the `notation install` task to the pipeline. 
- Similarly, search the `Notation` task from the pipeline editing panel again and choose **Sign**. 
- You can skip **Artifact references** since we sign an image using its latest digest that is built and pushed to the registry by a [Docker task](https://learn.microsoft.com/en-us/azure/devops/pipelines/tasks/reference/docker-v2?view=azure-pipelines&tabs=yaml). Instead, you can manually specify a digest using `<registry_host>/<repository>@<digest>`.
- Fill out the plugin configuration in the form. We will use the default AKV plugin and the service connection created in the previous step. Copy your Key ID from your AKV into the **Key ID**.
- Check the **Self-signed Certificate** box since we use a self-signed certificate for demonstration convenience. Instead, you can input your certificate file path in **Certificate Bundle File Path** if you want to use a CA issued certificate.
- Click **Add** to add the `notation sign` to the pipeline file left.

### Option 2: Editing the pipeline file

If you are familiar with Azure Pipeline and Notation, start with a template pipeline file will be efficient to use Notation tasks. 

Copy the same pipeline template below to your pipeline file. Then fill out the required values according to the references and comments below.

<details>

<summary>See the signing task template of option 1 (Click here).</summary>

```yaml
trigger:
 - main
pool: 
  vmImage: 'ubuntu-latest'

steps:
# log in to registry
- task: Docker@2
  inputs:
    containerRegistry: <your_docker_registry_service_connection>
    command: 'login'
# build and push artifact to registry
- task: Docker@2
  inputs:
    repository: <your_repository_name>
    command: 'buildAndPush'
    Dockerfile: './Dockerfile'
# install notation
- task: Notation@0
  inputs:
    command: 'install'
    version: '1.0.0'
# automatically detect the artifact pushed by Docker task and sign the artifact.
- task: Notation@0
  inputs:
    command: 'sign'
    plugin: 'azureKeyVault'
    akvPluginVersion: <azure_key_vault_plugin_version>
    azurekvServiceConection: <your_akv_service_connection>
    keyid: <your_key_id>
    selfSigned: true
```

</details>

> [!NOTE]  
> Apart from using the Docker task, you can sign a specified image digest by manually specifying an artifact reference in `artifactRefs` as follows.

<details>

<summary>See the example (Click here).</summary>

```yaml
# sign the artifact
- task: Notation@0
  inputs:
    artifactRefs: '<registry_host>/<repository>@<digest>'
    command: 'sign'
    plugin: 'azureKeyVault'
    akvPluginVersion: <azure_key_vault_plugin_version>
    azurekvServiceConection: <akv_service_connection>
    keyid: <key_id>
    selfSigned: true
```

</details>

## Trigger the pipeline

After filled out the inputs in the pipeline, you can save and run it to trigger the pipeline.

Go to **Job** page of the running pipeline, you will be able to see the execution result in each step. This pipeline will build and sign the latest build or the specified digest, then will push the signed image with its associated signature to the registry. On success, you will be able to see the image pushed to your ACR with a COSE format signature attached.

## Reference 

See [Inputs](README.md#inputs) for more details about the Notation Tasks configurations.