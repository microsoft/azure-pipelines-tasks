# Azure IoT Edge task

Use this task in a build or release pipeline to build, test, and deploy applications quickly and efficiently to Azure IoT Edge.

## Container registry types

### Azure Container Registry

<table><thead><tr><th>Parameters</th><th>Description</th></tr></thead>
<tr><td><code>containerregistrytype</code><br/>Container registry type</td><td>(Required) Select a <b>Container Registry Type</b>. <b>Azure Container Registry</b> for ACR and <b>Generic Container Registry</b> for generic registries including docker hub</td></tr>
<tr><td><code>azureSubscriptionEndpoint</code><br/>Azure subscription</td><td>(Required, if containerregistrytype = Azure Container Registry) Select an Azure subscription</td></tr>
<tr><td><code>azureContainerRegistry</code><br/>Azure Container Registry</td><td>(Required) Select an <b>Azure Container Registry</b></td></tr>
</table>

### Other container registries

<table><thead><tr><th>Parameters</th><th>Description</th></tr></thead>
<tr><td><code>containerregistrytype</code><br/>Container registry type</td><td>(Required) Select a <b>Container Registry Type</b>. <b>Azure Container Registry</b> for ACR and <b>Generic Container Registry</b> for generic registries including docker hub</td></tr>
<tr><td><code>dockerRegistryEndpoint</code><br/>Docker Registry Connection</td><td>(Required) Select a generic <b>Docker registry connection</b>. Required for <b>Build and Push</b></td></tr>
</table>

## Build module images

<table><thead><tr><th>Parameters</th><th>Description</th></tr></thead>
<tr><td><code>action</code><br/>Action</td><td>(Required) Select an Azure IoT Edge action<br/>Default value: Build module images</td></tr>
<tr><td><code>templateFilePath</code><br/>.template.json file</td><td>(Required) The path of Azure IoT Edge solution <b>.template.json</b>. This file defines the modules and routes in Azure IoT Edge solution, file name must end with <b>.template.json</b><br/>Default value: deployment.template.json</td></tr>
<tr><td><code>defaultPlatform</code><br/>Default platform</td><td>(Required) In <b>.template.json</b>, you can leave the modules platform unspecified. For these modules, the <b>default platform</b> will be used <br/>Default value: amd64</td></tr>
</table>

Following is a YAML example to build module images - 

```YAML
- task: AzureIoTEdge@2
  displayName: AzureIoTEdge - Build module images
  inputs:
    action: Build module images
    templateFilePath: deployment.template.json
    defaultPlatform: amd64  
```

## Push module images

<table><thead><tr><th>Parameters</th><th>Description</th></tr></thead>
<tr><td><code>action</code><br/>Action</td><td>(Required) Select an Azure IoT Edge action<br/>Default value: Build module images</td></tr>
<tr><td><code>templateFilePath</code><br/>.template.json file</td><td>(Required) The path of Azure IoT Edge solution <b>.template.json</b>. This file defines the modules and routes in Azure IoT Edge solution, file name must end with <b>.template.json</b><br/>Default value: deployment.template.json</td></tr>
<tr><td><code>defaultPlatform</code><br/>Default platform</td><td>(Required) In <b>.template.json</b>, you can leave the modules platform unspecified. For these modules, the <b>default platform</b> will be used <br/>Default value: amd64</td></tr>
<tr><td><code>bypassModules</code><br/>Bypass module(s)</td><td>(Optional) Select the module(s) that you <b>DO NOT</b> need to build (or push) in the .template.json, specify module names and separate with comma. Example: If you have 2 modules <b>SampleModule1,SampleModule2</b> in your .template.json, you want to just build or push <b>SampleModule1</b>, then you set the bypass modules as <b>SampleModule2</b>. Leave empty if you would like to build all the modules in .template.json.
</table>

Following is a YAML example to push module images - 

```YAML
variables:
    azureSubscriptionEndpoint: Contoso
    azureContainerRegistry: contoso.azurecr.io

steps:    
- task: AzureIoTEdge@2
  displayName: AzureIoTEdge - Push module images
  inputs:
    action: Push module images
    containerregistrytype: Azure Container Registry
    azureSubscriptionEndpoint: $(azureSubscriptionEndpoint)
    azureContainerRegistry: $(azureContainerRegistry)
    templateFilePath: deployment.template.json
    defaultPlatform: amd64  
```

## Deploy to IoT Edge devices

<table><thead><tr><th>Parameters</th><th>Description</th></tr></thead>
<tr><td><code>action</code><br/>Action</td><td>(Required) Select an Azure IoT Edge action<br/>Default value: Build module images</td></tr>
<tr><td><code>deploymentFilePath</code><br/>Deployment file</td><td>(Required) Select the deployment json file. If this task is in <b>release pipeline</b>, you need to set the location of deployment file in artifact (The default value works for most conditions). If this task is in <b>build pipeline</b>, you need to set it to the path of <b>Path of output deployment file</b><br/>Default value: $(System.DefaultWorkingDirectory)/**/*.json</td></tr>
<tr><td><code>connectedServiceNameARM</code><br/>Azure subscription contains IoT Hub</td><td>(Required) Select an <b>Azure subscription</b> that contains IoT Hub</td></tr>
<tr><td><code>iothubname</code><br/>IoT Hub name</td><td>(Required) Select the <b>IoT Hub</b></td></tr>
<tr><td><code>deviceOption</code><br/>Choose single/multiple device</td><td>(Required) Choose to deploy to single or multiple(by tags) devices</td></tr>
<tr><td><code>deploymentid</code><br/>IoT Edge deployment ID</td><td>(Required) Input the <b>IoT Edge Deployment ID</b>, if ID exists, it will be overridden. Up to 128 lowercase letters, numbers and the following characters are allowed [ -:+%_#*?!(),=@;' ]. Check more information for [Azure IoT Edge deployment](https://docs.microsoft.com/azure/iot-edge/how-to-deploy-monitor#monitor-a-deployment)<br/>Default value: $(System.TeamProject)-devops-deployment</td></tr>
<tr><td><code>priority</code><br/>IoT Edge deployment priority</td><td>(Required) Set the <b>priority</b> to a positive integer to resolve deployment conflicts: when targeted by multiple deployments a device will use the one with highest priority or (in case of two deployments with the same priority) latest creation time. <br/>Default value: 0</td></tr>
<tr><td><code>targetcondition</code><br/>IoT Edge device target condition</td><td>(Required) Input the <b>target condition</b> of devices you would like to deploy. Do not use double quote. Example: <b>tags.building=9 and tags.environment='test'</b>. Check more information for [Azure IoT Edge deployment](https://docs.microsoft.com/azure/iot-edge/how-to-deploy-monitor#monitor-a-deployment)
</tr>
<tr><td><code>deviceOption</code><br/>Choose single/multiple device</td><td>(Required) Choose to deploy to single or multiple(by tags) devices</td></tr>
<tr><td><code>deviceId</code><br/>IoT Edge device ID</td><td>(Required) Input the IoT Edge <b>device ID</b></td></tr>
</table>
