import tl = require('vsts-task-lib/task');
import util = require('util');

var azureRESTUtility = require ('azurerest-common/azurerestutility.js');
var parameterParser = require("./parameterparser.js").parse;

export async function deployWebAppImage(endPoint, resourceGroupName, webAppName) {
    var startupCommand = tl.getInput('StartupCommand', false);
    var appSettings = tl.getInput('AppSettings', false);
    var imageSourceAndTag;

    // Construct the image
    var dockerNamespace = tl.getInput('DockerNamespace', true);
    var dockerRepository = tl.getInput('DockerRepository', true);
    var dockerImageTag = tl.getInput('DockerImageTag', false);

    /*
        Special Case : If release definition is not linked to build artifacts
        then $(Build.BuildId) variable don't expand in release. So clearing state
        of dockerImageTag if $(Build.BuildId) not expanded in value of dockerImageTag.
    */
    if(dockerImageTag && (dockerImageTag.trim() == "$(Build.BuildId)")) {
        dockerImageTag = null;
    }

    if(dockerImageTag) {
        imageSourceAndTag = dockerNamespace + "/" + dockerRepository + ":" + dockerImageTag;
    } else {
        imageSourceAndTag = dockerNamespace + "/" + dockerRepository;
    }

    if(imageSourceAndTag)
    {
        tl.debug("Deploying the image " + imageSourceAndTag + " to the webapp " + webAppName);

        tl.debug("Updating the webapp configuration.");
        var updatedConfigDetails = JSON.stringify({
                "properties": {
                    "appCommandLine": startupCommand,
                    "linuxFxVersion": "DOCKER|" + imageSourceAndTag
                }
        });

        await azureRESTUtility.updateAzureRMWebAppConfigDetails(endPoint, webAppName, resourceGroupName, false, null, updatedConfigDetails);

        tl.debug("Updating the webapp application settings.");
        appSettings = appSettings ? appSettings.trim() : "";
        appSettings = "-DOCKER_CUSTOM_IMAGE_NAME " + imageSourceAndTag + " " + appSettings;

        // Update webapp application setting
        var webAppSettings = await azureRESTUtility.getWebAppAppSettings(endPoint, webAppName, resourceGroupName, false, null);
        mergeAppSettings(appSettings, webAppSettings);
        await azureRESTUtility.updateWebAppAppSettings(endPoint, webAppName, resourceGroupName, false, null, webAppSettings);
    }
}

function mergeAppSettings(appSettings, webAppSettings) {
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
}
