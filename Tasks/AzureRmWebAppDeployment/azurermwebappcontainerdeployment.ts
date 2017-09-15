import tl = require('vsts-task-lib/task');
import util = require('util');
import url = require('url');

var azureRESTUtility = require ('azurerest-common/azurerestutility.js');
var parameterParser = require("./parameterparser.js").parse;

enum registryTypes {
    "AzureContainerRegistry",
    "Registry", // TODO: Rename it to DockerHub while supporting all the registry types. Also add all these registry types in Task.json in ImageSource pick list.
    "PrivateRegistry"
}

export async function deployWebAppImage(endPoint, resourceGroupName, webAppName, deployToSlotFlag, slotName) {
    var startupCommand = tl.getInput('StartupCommand', false);

    var imageName = getImageName();
    var appName = deployToSlotFlag ? webAppName + "-" + slotName : webAppName;
    tl.debug("Deploying an image " + imageName + " to the webapp " + appName);

    // Update webapp configuration
    tl.debug("Updating the webapp configuration.");
    var updatedConfigDetails = JSON.stringify({
        "properties": {
            "appCommandLine": startupCommand,
            "linuxFxVersion": "DOCKER|" + imageName
        }
    });

    await azureRESTUtility.updateAzureRMWebAppConfigDetails(endPoint, webAppName, resourceGroupName, deployToSlotFlag, slotName, updatedConfigDetails);
    
    // Update webapp settings
    tl.debug("Updating the webapp application settings.");
    var webAppSettings = await getWebAppSettings(imageName, endPoint, webAppName, resourceGroupName, deployToSlotFlag, slotName);
    await azureRESTUtility.updateWebAppAppSettings(endPoint, webAppName, resourceGroupName, deployToSlotFlag, slotName, webAppSettings);
}

function getImageName() {
    var registryType = tl.getInput('ImageSource', true);
    var imageName = null;

    switch(registryType) {        
        case registryTypes[registryTypes.AzureContainerRegistry]:
            imageName = getAzureContainerImageName();
            break;

        case registryTypes[registryTypes.Registry]:
            imageName = getDockerHubImageName();
            break;

        case registryTypes[registryTypes.PrivateRegistry]:
            imageName = getPrivateRegistryImageName();
            break;
    }

    return imageName;
}

function getAzureContainerImageName() {
    var registry = tl.getInput('AzureContainerRegistryLoginServer', true) + ".azurecr.io";
    var image = tl.getInput('AzureContainerRegistryImage', true);
    var tag = tl.getInput('AzureContainerRegistryTag', false);

    return constructImageName(registry, image, tag);
}

function getDockerHubImageName() {
    var namespace = tl.getInput('DockerNamespace', true);
    var image = tl.getInput('DockerRepository', true);
    var tag = tl.getInput('DockerImageTag', false);

    return constructImageName(namespace, image, tag);
}

function getPrivateRegistryImageName() {
    var registryConnectedServiceName = tl.getInput('RegistryConnectedServiceName', true);
    var loginServer = tl.getEndpointAuthorizationParameter(registryConnectedServiceName, 'url', true);

    var registry = url.parse(loginServer).hostname;
    var image = tl.getInput('PrivateRegistryImage', true);
    var tag = tl.getInput('PrivateRegistryTag', false);

    return constructImageName(registry, image, tag);
}

function constructImageName(namespace, repository, tag) {
    var imageName = null;
    /*
        Special Case : If release definition is not linked to build artifacts
        then $(Build.BuildId) variable don't expand in release. So clearing state
        of dockerImageTag if $(Build.BuildId) not expanded in value of dockerImageTag.
    */
    if(tag && (tag.trim() == "$(Build.BuildId)")) {
        tag = null;
    }

    if(tag) {
        imageName = namespace + "/" + repository + ":" + tag;
    } else {
        imageName = namespace + "/" + repository;
    }

    return imageName;
}

export async function getWebAppSettings(imageName, endPoint, webAppName, resourceGroupName, deployToSlotFlag, slotName) {
    // Get new appsettings specified in the task
    var appSettingsParameters = tl.getInput('AppSettings', false);
    appSettingsParameters = appSettingsParameters ? appSettingsParameters.trim() : "";
    appSettingsParameters = await getContainerRegistrySettings(imageName, endPoint) + " " + appSettingsParameters;        

    // Get current appsettings of webapp
    var webAppSettings = await azureRESTUtility.getWebAppAppSettings(endPoint, webAppName, resourceGroupName, deployToSlotFlag, slotName);

    // Update the current webapp settings with new appsetting details
    updateWebAppSettings(appSettingsParameters, webAppSettings);

    return webAppSettings;
}

async function getContainerRegistrySettings(imageName,endPoint) {
    var containerRegistryType = tl.getInput('ImageSource', true);
    var containerRegistrySettings = "-DOCKER_CUSTOM_IMAGE_NAME " + imageName;
    var containerRegistryAuthParamsFormatString = "-DOCKER_REGISTRY_SERVER_URL %s -DOCKER_REGISTRY_SERVER_USERNAME %s -DOCKER_REGISTRY_SERVER_PASSWORD %s";

    switch(containerRegistryType) {
        case registryTypes[registryTypes.AzureContainerRegistry]:
            containerRegistrySettings = await getAzureContainerRegistrySettings(endPoint, containerRegistrySettings, containerRegistryAuthParamsFormatString);
            break;

        case registryTypes[registryTypes.Registry]:
            var dockerRespositoryAccess = tl.getInput('DockerRepositoryAccess', true);
            if(dockerRespositoryAccess === "private")
            {
                containerRegistrySettings = getDockerPrivateRegistrySettings(containerRegistrySettings, containerRegistryAuthParamsFormatString);
            }
            break;

        case registryTypes[registryTypes.PrivateRegistry]:
            containerRegistrySettings = getDockerPrivateRegistrySettings(containerRegistrySettings, containerRegistryAuthParamsFormatString);
            break;           
    }    

    return containerRegistrySettings;
    }

async function getAzureContainerRegistrySettings(endPoint, containerRegistrySettings, containerRegistryAuthParamsFormatString) {    
    var registryServerName = tl.getInput('AzureContainerRegistryLoginServer', true);
    var registryUrl = "https://" + registryServerName + ".azurecr.io";    
    tl.debug("Azure Container Registry Url: " + registryUrl);

    var registryName = tl.getInput('AzureContainerRegistry', true);
    var resourceGroupName = await azureRESTUtility.getResourceGroupName(endPoint, registryName, "Microsoft.ContainerRegistry/registries");
    tl.debug("Resource group name of a registry: " + resourceGroupName);

    var creds = await azureRESTUtility.getAzureContainerRegistryCredentials(endPoint, registryName, resourceGroupName);
    tl.debug("Successfully retrieved the registry credentials");

    var username = creds.username;
    var password = creds["passwords"][0].value;

    return containerRegistrySettings + " " + util.format(containerRegistryAuthParamsFormatString, registryUrl, username, password);
        }

function getDockerPrivateRegistrySettings(containerRegistrySettings, containerRegistryAuthParamsFormatString) {
    var registryConnectedServiceName = tl.getInput('RegistryConnectedServiceName', true);    
    var username = tl.getEndpointAuthorizationParameter(registryConnectedServiceName, 'username', true);
    var password = tl.getEndpointAuthorizationParameter(registryConnectedServiceName, 'password', true);    
    var registryUrl = tl.getEndpointAuthorizationParameter(registryConnectedServiceName, 'registry', true);

    tl.debug("Docker or Private Container Registry Url: " + registryUrl);

    return containerRegistrySettings + " " + util.format(containerRegistryAuthParamsFormatString, registryUrl, username, password);
}

function updateWebAppSettings(appSettingsParameters, webAppSettings) {
    // In case of public repo, clear the connection details of a registry
    var dockerRespositoryAccess = tl.getInput('DockerRepositoryAccess', true);
    
    // Uncomment the below lines while supprting all registry types.
    // if(dockerRespositoryAccess === "public")
    // {
    //     deleteRegistryConnectionSettings(webAppSettings);
    // }
    
    var parsedAppSettings =  parameterParser(appSettingsParameters);
    for (var settingName in parsedAppSettings) {
        var setting = settingName.trim();
        var settingVal = parsedAppSettings[settingName].value;
        settingVal = settingVal ? settingVal.trim() : "";

        if(setting) {
            webAppSettings["properties"][setting] = settingVal;
        }
    }
}

function deleteRegistryConnectionSettings(webAppSettings) {
    delete webAppSettings["properties"]["DOCKER_REGISTRY_SERVER_URL"];
    delete webAppSettings["properties"]["DOCKER_REGISTRY_SERVER_USERNAME"];
    delete webAppSettings["properties"]["DOCKER_REGISTRY_SERVER_PASSWORD"];
}
