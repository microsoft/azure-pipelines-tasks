# Azure Container Apps Build and Deploy

This Azure Pipelines Task allows users to easily deploy their application source to an
[Azure Container App](https://azure.microsoft.com/en-us/services/container-apps/) in their Azure Pipelines workflow by
either providing a previously built image, a Dockerfile that an image can be built from, or using a builder to create a
runnable application image for the user.

If no Dockerfile is found or provided in the provided application source, the following steps are performed by this task:

- Uses the Oryx++ Builder to build the application source using [Oryx](https://github.com/microsoft/Oryx) to produce a
  runnable application image
- Pushes this runnable application image to the provided Azure Container Registry
- Creates or updates a Container App based on this image

If a Dockerfile is found or discovered in the application source, the builder won't be used and the image will be built
with a call to `docker build` and the Container App will be created or updated based on this image.

If a previously built image has already been pushed to the ACR instance and is provided to this task, no application
source is required and the image will be used when creating or updating the Container App.

A YAML configuration file can also be provided to modify specific properties on the Container App that is created or
updated; please see the section below on the `yamlConfigPath` argument.

## Running this task on Microsoft-hosted agents

If you are running this task on a
[Microsoft-hosted agent](https://learn.microsoft.com/en-us/azure/devops/pipelines/agents/hosted), you may find that this
task is _not_ able to run successfully with the following operating systems:

- macOS
  - The [macOS runners](https://github.com/actions/runner-images#available-images) provided by Microsoft do not come
  installed with Docker (more information [here](https://github.com/actions/runner-images/issues/17#issuecomment-614726536));
  as a result, this task is not able to run any `docker` commands, such as pushing the built runnable application images
  to ACR.
- Windows
  - The [Windows runners](https://github.com/actions/runner-images#available-images) provided by Microsoft comes with
  Docker installed, but by default, Linux-based images are unable to be pulled down; as a result, this task is not able
  to pull down the Oryx builder to create runnable application images from provided application source.

Please see the below **Docker** prerequisite section for more information.

## Data/Telemetry Collection Notice

By default, this Azure DevOps Task collects the following pieces of data for Microsoft:
- The Container App build and deploy scenario targeted by the user
  - _i.e._, used the Oryx++ Builder, used a provided/found Dockerfile, or provided a previously built image
  - _Note_: the image name is _not_ collected
- The processing time of the task, in milliseconds
- The result of the task
  - _i.e._, succeeded or failed
- If the Oryx++ Builder is used, events and metrics relating to building the provided application using Oryx

If you want to disable data collection, please set the `disableTelemetry` argument to `true`.

## Prerequisites

Prior to running this task, Azure resources and an Azure DevOps service connection are either required or optional
depending on the arguments provided to this task.

### Azure DevOps Service Connection

To deploy to Azure, an Azure subscription has to be linked to Team Foundation Server or to Azure Pipelines using the
Services tab in the settings section. Add the Azure subscription to use in the Build or Release Management definition by
opening the Account Administration screen (gear icon on the top-right of the screen) and then click on the Services Tab.

Create the [ARM](https://azure.microsoft.com/en-in/documentation/articles/resource-group-overview/) service endpoint and
use the **'Azure Resource Manager'** endpoint type; for more information on creating service connections, please follow
[this document](https://learn.microsoft.com/en-us/azure/devops/pipelines/library/service-endpoints).

### Azure CLI

This task requires that the Azure CLI is installed on the Azure Pipelines agent to execute a variety of commands
throughout the execution of the task. For more information on how to install the Azure CLI on the agent, please see
[this document](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli). If an agent is already running on the
machine on which the Azure CLI is installed, ensure that you restart the agent so that all relevant environment
variables are updated.

### Docker

This task requires that Docker is installed on the Azure Pipelines agent to push images to the provided Azure Container
Registry. For more information on how to install Docker on the agent, please see
[this document](https://docs.docker.com/get-docker/).

In addition, users running this task with a Windows agent may encounter an issue with not being able to pull down
Linux-based images; to resolve this, please visit
[this site](https://docs.docker.com/desktop/faqs/windowsfaqs/#how-do-i-switch-between-windows-and-linux-containers) or
located the `DockerCli.exe` file on your agent (typically in the `Program Files\Docker\Docker` folder) and run

```
& `.\DockerCli.exe` -SwitchDaemon
```

If Docker is not installed on the agent running this task, the following scenario(s) are still enabled:
- Providing a _previously built_ image to the `imageToDeploy` argument that the Container App deploys with

If Docker is on the agent, but unable to work with Linux-based images, the following scenario(s) are still enabled:
- Providing a _previously built_ image to the `imageToDeploy` argument that the Container App deploys with
- Providing a `Dockerfile` as a part of your application source that will be built and deployed with the Container App
  - _Note_: the `Dockerfile` cannot have any Linux-based image layers

### pack CLI

The [pack CLI](https://buildpacks.io/docs/tools/pack/) is maintained by the Cloud Native Buildpacks project and is used
by this task to create runnable application images for the user when the application source code is provided and no
additional Dockerfile is provided or found. A [builder](https://buildpacks.io/docs/concepts/components/builder/) was
created by Oryx to take in the application source code provided to this task and produce an image that could then be
pushed to an image registry and used within a Container App to build and run the application.

A stable version of the pack CLI is installed on the Azure Pipelines agent executing the task, and depending on the base
OS of this agent, different tools will be leverage to assist with the installation:
- On Windows runners:
  - A set of PowerShell commands are executed to do the following:
    - Creates a `pack` folder in the agent's temporary folder, if the `pack` folder doesn't already exist
    - Downloads the pack CLI `.zip` into this `pack` folder
    - Unzips the content from this `.zip` and places them in the `pack` folder
    - Deletes the `.zip`
- On non-Windows runners:
  - `curl` will be used to pull down the `.tgz` containing the `pack` executable
  - `tar` will be used to unzip the `.tgz` and place the `pack` executable in `/usr/local/bin`

### Azure Container Registry

An [Azure Container Registry](https://azure.microsoft.com/en-us/products/container-registry/) must exist that the user
is able to push container images to. This task will leverage the Azure Container Registry to either push a built
runnable application image to and/or deploy a Container App from.

The name of the Azure Container Registry is required via the `acrName` argument.

The user can also provide values for the `acrUsername` and `acrPassword` arguments that will authenticate calls to the
Azure Container Registry instance; if not provided, an access token will be generated via the Azure CLI that will
authenticate the calls instead.

### Azure Container App environment

An [Azure Container App environment](https://docs.microsoft.com/en-us/azure/container-apps/environment) is recommended
to have been previously created by the user to improve the performance of the task. If no environment has been
created before, or if an environment cannot be found in the resource group that is being used to host the created
Container App, then an environment will be created by as a part of the `az containerapp up` command, which may take
additional time.

## Arguments

Below are the arguments that can be provided to the Azure Container Apps Build and Deploy Azure DevOps Task.

_Note_: Although no argument is officially marked as "required" in the metadata of this task, some arguments will
need to be provided in order for this task to successfully run using one of the two main scenarios.

| Argument name             | Required | Description |
| ------------------------- | -------- | ----------- |
| `acrName`                 | Yes (for this scenario) | The name of the Azure Container Registry that the runnable application image will be pushed to. |
| `appSourcePath`           | Yes (for this scenario) | Absolute path on the Azure Pipelines agent of the source application code to be built. |

### Arguments required for using an already pushed application image

| Argument name             | Required | Description |
| ------------------------- | -------- | ----------- |
| `imageToDeploy`           | Yes (for this scenario) | The name of the image that has already been pushed to a registry and will be deployed to the Container App by this task. If this image is found in an ACR instance that requires authentication to pull, the `acrName` argument, or the `acrUsername` and `acrPassword` arguments, can be provided to authenticate requests to the ACR instance. |

### Arguments required for using a YAML configuration file

| Argument name             | Required | Description |
| ------------------------- | -------- | ----------- |
| `yamlConfigPath`          | Yes (for this scenario) | Full path (on the executing Azure Pipelines agent) to the YAML file detailing the configuration of the Container App. |

#### Important notes on the YAML configuration file

The `resourceGroup` property in the YAML configuration file _will not_ be used; the value for this either comes from
the `resourceGroup` argument provided to the task, or the default resource group name generated by the task. All other
properties provided in the YAML configuration file will override the values provided as arguments to this task; for
example, if the `containerAppName` argument is provided to the task, and the `name` property is set in the YAML
configuration file, the `name` property in the YAML file will be used when creating or updating the Container App.

Image and application source arguments (_e.g._, `appSourcePath`, `imageToDeploy`) will still be used to first build
and/or push an image that is used by the Container App; in this case, the provided YAML configuration file will need to
reference the image specified by `imageToDeploy` (or `imageToBuild`, depending on your scenario).

When creating a new Container App, all properties listed in the YAML configuration file (except `resourceGroup` as
mentioned above) will be set when the Container App is created. When updating an existing Container App, only the
properties listed in the file will be updated on the Container App.

Currently, the YAML file does not support setting up managed identity authentication for the container registry used;
for more information on this issue, please see
[this GitHub issue](https://github.com/microsoft/azure-container-apps/issues/524).

In cases where the `yamlConfigPath` argument is provided, the YAML file will be passed through to the corresponding
`az containerapp` command, either
[`create`](https://learn.microsoft.com/en-us/cli/azure/containerapp?view=azure-cli-latest#az-containerapp-create) or
[`update`](https://learn.microsoft.com/en-us/cli/azure/containerapp?view=azure-cli-latest#az-containerapp-update)
depending on your scenario. For more information on the intended behavior when the YAML configuration file is provided,
please see the documents linked for the corresponding commands.

For more information on the structure of the YAML configuration file, please visit [this site](https://aka.ms/azure-container-apps-yaml).

### Additional arguments

| Argument name             | Required | Description |
| ------------------------- | -------- | ----------- |
| `connectedServiceNameARM` | Yes      | Service connection linked to the user's Azure Subscription where the Container App will be created/updated. This service connection _must_ have proper permissions to make these changes within the subscription (_e.g._, Contributor role). |
| `acrUsername`             | No       | The username used to authenticate push requests to the provided Azure Container Registry. If not provided, an access token will be generated via "az acr login" and provided to "docker login" to authenticate the requests. |
| `acrPassword`             | No       | The password used to authenticate push requests to the provided Azure Container Registry. If not provided, an access token will be generated via "az acr login" and provided to "docker login" to authenticate the requests. |
| `dockerfilePath`          | No       | Relative path (_without file prefixes, see example below_) to the Dockerfile in the provided application source that should be used to build the image that is then pushed to ACR and deployed to the Container App. If not provided, this task will check if there is a file named `Dockerfile` in the provided application source and use that to build the image. Otherwise, the Oryx++ Builder will be used to create the image. |
| `imageToBuild`            | No       | The custom name of the image that is to be built, pushed to ACR and deployed to the Container App by this task. _Note_: this image name should include the ACR server; _e.g._, `<acr-name>.azurecr.io/<repo>:<tag>`. If this argument is not provided, a default image name will be constructed in the form of `<acr-name>.azurecr.io/ado-task/container-app:<build-id>.<build-number>` |
| `containerAppName`        | No       | The name of the Container App that will be created or updated. If not provided, this value will be `ado-task-app-<build-id>-<build-number>`. |
| `resourceGroup`           | No       | The existing resource group that the Azure Container App will be created in. If not provided, this value will be `<container-app-name>-rg` and its existence will first be checked before attempting to create it. |
| `containerAppEnvironment` | No       | The name of the Container App environment to use with the application. If not provided, an existing environment in the resource group of the Container App will be used, otherwise, an environment will be created in the form of `<container-app-name>-env`. |
| `runtimeStack`            | No       | The platform version stack used in the final runnable application image that is deployed to the Container App. The value should be provided in the form of `<platform>:<version>`. If not provided, this value is determined by Oryx based on the contents of the provided application. Please refer to [this document](https://github.com/microsoft/Oryx/blob/main/doc/supportedRuntimeVersions.md) for more information on supported runtime stacks for Oryx. |
| `targetPort`              | No       | The designated port for the application to run on. If no value is provided and the builder is used to build the runnable application image, the target port will be set to 80 for Python applications and 8080 for all other platform applications. If no value is provided when creating a Container App, the target port will default to 80. Note: when using this task to update a Container App, the target port may be updated if not provided based on changes to the ingress property. |
| `location`                | No       | The location that the Container App (and other created resources) will be deployed to. To view locations suitable for creating the Container App in, please run the following: `az provider show -n Microsoft.App --query "resourceTypes[?resourceType=='containerApps'].locations"` |
| `environmentVariables`    | No       | A list of environment variable(s) for the container. Space-separated values in 'key=value' format. Empty string to clear existing values. Prefix value with 'secretref:' to reference a secret. |
| `ingress`                 | No       | Possible options: external, internal, disabled. If set to `external` (default value if not provided when creating a Container App), the Container App will be visible from the internet or a VNET, depending on the app environment endpoint configured. If set to `internal`, the Container App will be visible from within the app environment only. If set to `disabled`, ingress will be disabled for this Container App and will not have an HTTP or TCP endpoint. |
| `disableTelemetry`        | No       | If set to `true`, no telemetry will be collected by this Azure DevOps Task. If set to `false`, or if this argument is not provided, telemetry will be sent to Microsoft about the Container App build and deploy scenario targeted by this Azure DevOps Task. |

## Usage

Below are a set of examples outlining how to use this task in different scenarios.

### Minimal - Build application image for Container App

```yml
steps:

  - task: AzureContainerApps@0
    displayName: Build and deploy Container App
    inputs:
      connectedServiceNameARM: 'azure-subscription-service-connection'
      appSourcePath: '$(System.DefaultWorkingDirectory)'
      acrName: 'mytestacr'
```

This will create a new Container App named `ado-task-app-<build-id>-<build-number>` in a new resource group named
`<container-app-name>-rg`. The Container App will be based off of an image that was built from the provided
`appSourcePath` and pushed to the provided ACR instance. An access token will be generated to authenticate the push to
the provided ACR instance.

### Minimal - Use previously published image for Container App

```yml
steps:

  - task: AzureContainerApps@0
    displayName: Build and deploy Container App
    inputs:
      connectedServiceNameARM: 'azure-subscription-service-connection'
      imageToDeploy: mcr.microsoft.com/azuredocs/containerapps-helloworld:latest
```

This will create a new Container App named `ado-task-app-<build-id>-<build-number>` in a new resource group named
`<container-app-name>-rg` where **no new image is built**, but an existing image named
`mcr.microsoft.com/azuredocs/containerapps-helloworld:latest` will be used for the Container App.

### Minimal - Use YAML configuration file with previously published image for Container App

```yml
steps:

  - task: AzureContainerApps@0
    displayName: Build and deploy Container App
    inputs:
      yamlConfigPath: simple-image-container-app.yaml
```

This will create a new Container App named `ado-task-app-<build-id>-<build-number>` in a new resource group named
`<container-app-name>-rg` where **no new image is built**, but an existing image named
`mcr.microsoft.com/azuredocs/containerapps-helloworld:latest` will be used for the Container App. Additional properties
about the Container App will be pulled from the `simple-image-container-app.yaml` file and will override any additional
values that would've been provided to the task as arguments **excluding `resourceGroup`**.

The `simple-image-container-app.yaml` file has the following structure:

```yml
properties:
  managedEnvironmentId: /subscriptions/SUBSCRIPTION_ID/resourceGroup/RESOURCE_GROUP/providers/Microsoft.App/managedEnvironments/CONTAINER_APP_ENVIRONMENT
  configuration:
    ingress:
      external: true
      allowInsecure: false
      targetPort: 80
  template:
    containers:
      - image: mcr.microsoft.com/azuredocs/containerapps-helloworld:latest
        name: mysampleimagecontainer
```

The values for `SUBSCRIPTION_ID`, `RESOURCE_GROUP` and `CONTAINER_APP_ENVIRONMENT` must be updated to point to the full
resource ID of the **existing** Container App environment that the Container App will use.

### Using ACR credentials to authenticate

```yml
steps:

  - task: AzureContainerApps@0
    displayName: Build and deploy Container App
    inputs:
      connectedServiceNameARM: 'azure-subscription-service-connection'
      appSourcePath: '$(System.DefaultWorkingDirectory)'
      acrName: 'mytestacr'
      acrUsername: $(ACR_USERNAME_SECRET)
      acrPassword: $(ACR_PASSWORD_SECRET)
```

This will create a new Container App named `ado-task-app-<build-id>-<build-number>` in a new resource group named
`<container-app-name>-rg`. The Container App will be based off of an image that was built from the provided
`appSourcePath` and pushed to the provided ACR instance. The provided ACR credentials will be used to authenticate calls
to the ACR instance.

### Container App name provided

```yml
steps:

  - task: AzureContainerApps@0
    displayName: Build and deploy Container App
    inputs:
      connectedServiceNameARM: 'azure-subscription-service-connection'
      appSourcePath: '$(System.DefaultWorkingDirectory)'
      acrName: 'mytestacr'
      containerAppName: 'my-test-container-app'
```

This will create a new Container App named `my-test-container-app` in a new resource group name
`my-test-container-app-rg`.

### Resource group provided

```yml
steps:

  - task: AzureContainerApps@0
    displayName: Build and deploy Container App
    inputs:
      connectedServiceNameARM: 'azure-subscription-service-connection'
      appSourcePath: '$(System.DefaultWorkingDirectory)'
      acrName: 'mytestacr'
      resourceGroup: 'my-test-rg'
```

This will create a new Container App named `ado-task-app-<build-id>-<build-number>` in a resource group named
`my-test-rg`. If the `my-test-rg` resource group does not exist, it will be created as a part of this task.

### Container App name and resource group provided

```yml
steps:

  - task: AzureContainerApps@0
    displayName: Build and deploy Container App
    inputs:
      connectedServiceNameARM: 'azure-subscription-service-connection'
      appSourcePath: '$(System.DefaultWorkingDirectory)'
      acrName: 'mytestacr'
      containerAppName: 'my-test-container-app'
      resourceGroup: 'my-test-rg'
```

This will create a new Container App named `my-test-container-app` in a resource group named `my-test-rg`. If the
`my-test-rg` resource group does not exist, it will be created as a part of this task.

### Container App environment provided

```yml
steps:

  - task: AzureContainerApps@0
    displayName: Build and deploy Container App
    inputs:
      connectedServiceNameARM: 'azure-subscription-service-connection'
      appSourcePath: '$(System.DefaultWorkingDirectory)'
      acrName: 'mytestacr'
      containerAppEnvironment: 'my-test-container-app-env'
```

This will create a new Container App named `ado-task-app-<build-id>-<build-number>` in a new resource group named
`<container-app-name>-rg` with a new Container App environment named `my-test-container-app-env`.

### Runtime stack provided

```yml
steps:

  - task: AzureContainerApps@0
    displayName: Build and deploy Container App
    inputs:
      connectedServiceNameARM: 'azure-subscription-service-connection'
      appSourcePath: '$(System.DefaultWorkingDirectory)'
      acrName: 'mytestacr'
      runtimeStack: 'dotnetcore:7.0'
```

This will create a new Container App named `ado-task-app-<build-id>-<build-number>` in a new resource group named
`<container-app-name>-rg` where the runnable application image is using the .NET 7 runtime stack.

### Dockerfile provided

```yml
steps:

  - task: AzureContainerApps@0
    displayName: Build and deploy Container App
    inputs:
      connectedServiceNameARM: 'azure-subscription-service-connection'
      appSourcePath: '$(System.DefaultWorkingDirectory)'
      acrName: 'mytestacr'
      dockerfilePath: 'test.Dockerfile'
```

This will create a new Container App named `ado-task-app-<build-id>-<build-number>` in a new resource group named
`<container-app-name>-rg` where the runnable application image was created from the `test.Dockerfile` file found in the
provided application source path directory.

_Note_: for values provided to `dockerfilePath`, no file prefixes should be included (_e.g._, `./test.Dockerfile` should
be passed as just `test.Dockerfile`). The provided `appSourcePath` and `dockerfilePath` arguments will be concatenated
inside of the task.

### Image to build provided

```yml
steps:

  - task: AzureContainerApps@0
    displayName: Build and deploy Container App
    inputs:
      connectedServiceNameARM: 'azure-subscription-service-connection'
      appSourcePath: '$(System.DefaultWorkingDirectory)'
      acrName: 'mytestacr'
      imageToBuild: 'mytestacr.azurecr.io/app:latest'
```

This will create a new Container App named `ado-task-app-<build-id>-<build-number>` in a new
resource group named `<container-app-name>-rg` where the image built and pushed to ACR is named
`mytestacr.azurecr.io/app:latest`

## Contributing

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Issues and feedback

For any issues and feedback for the _official_ `AzureContainerApps` task, please create a new issue
[in the `azure-pipelines-tasks` repository](https://github.com/microsoft/azure-pipelines-tasks/issues).

Do you think there might be a security issue? Have you been phished or identified a security vulnerability? Please don't
report it here - let us know by sending an email to secure@microsoft.com.