# YAML getting started - App Service task

Proposed changes for YAML friendly App service task. For example, typed tasks for WebApp for Windows, Linux (ContainerApp), 
and FunctionApps. 

Default is Azure WebApp step for Windows or Linux

```yaml
steps:
- task: AzureWebApp@0
#Typed task for WebApp for Windows or Linux, shorthand needs only the subscription, webapp and package.
  displayName: 'Azure WebApp for Windows: myWindowsWebApp'
  inputs:
    azureSubscription: 'my subscription'
    webAppName: 'myWindowsWebApp'
    package: '$(build.artifactstagingdirectory)/**/*.zip'  #can work with *.war, *.jar or a folder. 
```

Full version for Azure WebApp on Windows

```yaml
pool: 
  image: Hosted VS2017
steps:
- task: AzureWebApp@0
#Typed task for WebApp for Windows or Linux, shorthand needs only the subscription, webapp and package.
  displayName: 'Azure WebApp for Windows: myWindowsWebApp'
  inputs:
    azureSubscription: 'my subscription'
    webAppName: 'myWindowsWebApp'
    package: '$(build.artifactstagingdirectory)/**/*.zip'  #can work with *.war, *.jar or a folder. 
    
    resourceGroup: 'myRG' 
    # the Resource group name is required when the deployment target is in an App Service Environment
    
    slotName: staging
    # deploy to slot
 
    virtualApplication: 'myvirtualwebapp'
    # name of the Virtual application that has been configured in the Azure portal. 

    customWebConfig: '-Handler iisnode -NodeStartFile server.js -appType node'
    # generate a web.config file with the specified parameters. 

    # following are supported only for WebDeploy option and not available for zipDeploy or runFromZip.
    deploymentMethod: 'WebDeploy' # Kudu or runFromZip
    setParametersFile: '$(System.DefaultWorkingDirectory)/SetParameters.xml'
    removeAdditionalFilesFlag: true
    additionalArguments: '-disableLink:AppPoolExtension -disableLink:ContentExtension'
```

Note, we need to move file transformation, variable substitution, app/configuration settings features out. 
AppTypes - Windows, Linux Container, FunctionApp etc can be queried and right deployment method can be set


Full version for Azure WebApp on Linux

```yaml
pool: 
  image: Hosted VS2017
steps:
- task: AzureWebApp@0
#ToDo to add runtime (optional)
```

WebApp for Containers, example -

```yaml
pool: 
  image: 'Ubuntu 1604'
steps:
- task: AzureWebAppContainers@0
# WebApp for containers Windows(private preview)/Linux deployment
  displayName: 'Azure WebApp Containers: myLinuxContainerWebApp'
  inputs:
    azureSubscription: 'my subscription'
    WebAppName: 'myLinuxContainerWebApp'
    containerRegistry: 'myreg.azurecr.io'
    imageName: '$(Build.Repository.Name):$(Build.BuildId)'
    containerCommand: 'python app.py'
```

Full version for Azure WebApp for Containers

```yaml
pool: 
  image: Hosted VS2017
steps:
- task: AzureWebAppContainers@0
#ToDo move application settings/connnection settings to Manage task, add new support for connection strings
#ToDo support for multi-containers, AKS (either compose yaml or deployment yaml)
```

Function Apps, example -

```yaml
pool: 
  image: 'Ubuntu 1604'
steps:
- task: AzureFunctionApp@0
# FunctionApp deployment
  displayName: 'Azure FunctionApp: myfunctionApp'
  inputs:
    azureSubscription: 'my subscription'
    WebAppName: 'myfunctionApp'
    package: '$(System.DefaultWorkingDirectory)/**/*.zip'
```

Full version for Azure Function App on Windows

```yaml
pool: 
  image: Hosted VS2017
steps:
- task: AzureFunctionApp@0
#ToDo move application settings/connnection settings to Manage task, add new support for connection strings
```

Full version for Azure Function App on Linux

```yaml
pool: 
  image: Hosted VS2017
steps:
- task: AzureFunctionApp@0
#ToDo move application settings/connnection settings to Manage task, add new support for connection strings
#ToDo add runtime
```

Full version for Azure Function App on Linux containers

```yaml
pool: 
  image: Hosted VS2017
steps:
- task: AzureFunctionApp@0
#ToDo move application settings/connnection settings to Manage task, add new support for connection strings
#ToDo containers related inputs  
```
Full version example, 

```yaml
pool: 
  image: Hosted VS2017
steps:
- task: AzureWebApp@4
  displayName: 'Azure WebApp for Windows: myWindowsWebApp'
  inputs:
    azureSubscription: 'my subscription'
    webAppName: 'myWindowsWebApp'    
    package: '$(build.artifactstagingdirectory)/**/*.zip'
    
