import tl = require('vsts-task-lib/task');
import util = require('util');

var azureRESTUtility = require ('azurerest-common/azurerestutility.js');
var parameterParser = require("./parameterparser.js").parse;

export async function deployWebAppImage(endPoint, dockerNamespace, resourceGroupName, webAppName) {
    var startupCommand = tl.getInput('StartupCommand', false);
    var appSettings = tl.getInput('AppSettings', false);
    var imageSourceAndTag;

    // Construct the image
    var dockerRepository = tl.getInput('DockerRepository', true);
    var dockerImageTag = tl.getInput('DockerImageTag', false);

    if(dockerImageTag) {
        imageSourceAndTag = dockerNamespace + "/" + dockerRepository + ":" + dockerImageTag;          
    } else {
        imageSourceAndTag = dockerNamespace + "/" + dockerRepository;
    }

    if(imageSourceAndTag)
    {
        tl.debug("Deploying the image " + imageSourceAndTag + " to the webapp " + webAppName);
        
        appSettings = appSettings ? appSettings.trim() : "";        
        appSettings = "-DOCKER_CUSTOM_IMAGE_NAME " + imageSourceAndTag + " " + appSettings;
    
        // Update web application setting
        var webAppSettings = await azureRESTUtility.getWebAppAppSettings(endPoint, webAppName, resourceGroupName, false, null);
        updatedWebAppSettings(appSettings, webAppSettings);
        await azureRESTUtility.updateWebAppAppSettings(endPoint, webAppName, resourceGroupName, false, null, webAppSettings);

        // Update startup command
        if(startupCommand)
        {            
            tl.debug("Updating the startup command: " + startupCommand);
            var updatedConfigDetails = JSON.stringify(
            {
                "properties": {
                    "appCommandLine": startupCommand
                }
            });

            await azureRESTUtility.updateAzureRMWebAppConfigDetails(endPoint, webAppName, resourceGroupName, false, null, updatedConfigDetails);            
        }  
    }  
}

async function updatedWebAppSettings(appSettings, webAppSettings) {
//    tl.debug(util.format("New web application settings provided by user: %j", appSettings));        

    var parsedAppSettings =  parameterParser(appSettings);
    for (var settingName in parsedAppSettings)
    {
        var setting = settingName.trim();
        var settingVal = parsedAppSettings[settingName].value; 
        settingVal = settingVal ? settingVal.trim() : "";

        if(setting) {
            webAppSettings["properties"][setting] = settingVal;
        }
    }        

  //  tl.debug(util.format("Updated web application settings: %j", webAppSettings));
                            
    return webAppSettings;
}