# YAML getting started - App Service task

Proposed changes for YAML friendly App service task. For example, typed tasks for WebApp for Windows, Linux (ContainerApp), 
and FunctionApps. 

```yaml
pool: 
  image: Hosted VS2017
steps:
- task: AzureWebAppWindows@0
# Typed task (or alias) for WebApp for Windows, shorthand needs only the subscription, webapp and package.
  displayName: 'Azure WebApp for Windows: myWindowsWebApp'
  inputs:
    azureSubscription: 'my subscription'
    webAppName: 'myWindowsWebApp'
    package: '$(build.artifactstagingdirectory)/**/*.zip'
```

Full version example, 

```yaml
pool: 
  image: Hosted VS2017
steps:
- task: AzureWebAppWindows@4
  displayName: 'Azure WebApp for Windows: myWindowsWebApp'
  inputs:
    azureSubscription: 'my subscription'
    webAppName: 'myWindowsWebApp'    
    package: '$(build.artifactstagingdirectory)/**/*.zip'
    
    slotName: staging
    # deploy to slot
 
    virtualApplication: myvirtualwebapp
    # name of the Virtual application that has been configured in the Azure portal. 

    customWebConfig: '-Handler iisnode -NodeStartFile server.js -appType node'
    # generate a web.config file with the specified parameters. 

    AppSettings: '-Port 5000 -RequestTimeout 5000 -WEBSITE_TIME_ZONE "Eastern Standard Time"'
    ConfigurationSettings: '-phpVersion 5.6 -linuxFxVersion: node|6.11'
    # Update app settings and configuration settings. 

    # following are supported only for WebDeploy option and not available for zipDeploy or runFromZip.
    SetParametersFile: '$(System.DefaultWorkingDirectory)/SetParameters.xml'
    RemoveAdditionalFilesFlag: true
    AdditionalArguments: '-disableLink:AppPoolExtension -disableLink:ContentExtension'

Note, we need to move file transformation and variable substitution features out into a separate task. 
AppTypes - Windows, Linux Container, FunctionApp etc can be queried and right deployment method can be set


WebApp for Linux Container, example -

```yaml
pool: 
  image: 'Ubuntu 1604'
steps:
- task: AzureWebAppContainersLinux@0
# WebApp for containers Linux deployment
  displayName: 'Azure WebApp Linux Containers: myLinuxContainerWebApp'
  inputs:
    azureSubscription: 'my subscription'
    WebAppName: 'myLinuxContainerWebApp'
    containerRegistry: 'myreg.azurecr.io'
    imageName: '$(Build.Repository.Name):$(Build.BuildId)'
    containerCommand: 'python app.py'
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


Function Aop Linux Container, example -

```yaml
pool: 
  image: 'Ubuntu 1604'
steps:
- task: AzureFunctionAppContainersLinux@0
# FunctionApp for containers deployment
  displayName: 'Azure App Service Deploy: functionappcontainers'
  inputs:
    azureSubscription: 'my subscription'
    WebAppName: 'functionappcontainers'
    containerRegistry: 'myreg.azurecr.io'
    imageName: '$(Build.Repository.Name):$(Build.BuildId)'
    containerCommand: 'python app.py'      
```
