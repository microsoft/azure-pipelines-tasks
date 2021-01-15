import tl = require('azure-pipelines-task-lib/task');
import url = require('url');
import util = require('util');
import { AzureAppService } from '../azure-arm-rest/azure-arm-app-service';
import { parse }  from './ParameterParserUtility';
import { AzureAppServiceUtility } from './AzureAppServiceUtility';
import fs = require('fs');
import path = require('path');
var deployUtility = require('../webdeployment-common/utility.js');

enum registryTypes {
    "AzureContainerRegistry",
    "Registry", // TODO: Rename it to DockerHub while supporting all the registry types. Also add all these registry types in Task.json in ImageSource pick list.
    "PrivateRegistry"
}

export class ContainerBasedDeploymentUtility {
    private _appService: AzureAppService;
    private _appServiceUtility: AzureAppServiceUtility;

    constructor(appService: AzureAppService) {
        this._appService = appService;
        this._appServiceUtility = new AzureAppServiceUtility(appService);
    }

    public async deployWebAppImage(properties: any): Promise<void> {
        let imageName: string = properties["ImageName"];
        let multicontainerConfigFile: string = properties["MulticontainerConfigFile"];
        let isMultiContainer: boolean = properties["isMultiContainer"];
        let isLinuxApp: boolean = properties["isLinuxContainerApp"];
        let updatedMulticontainerConfigFile: string = multicontainerConfigFile;

        if(isMultiContainer) {
            tl.debug("Deploying Docker-Compose file " + multicontainerConfigFile + " to the webapp " + this._appService.getName());
            if(imageName) {
                updatedMulticontainerConfigFile = this.updateImagesInConfigFile(multicontainerConfigFile, imageName);
            }

            // uploading log file
            console.log(`##vso[task.uploadfile]${updatedMulticontainerConfigFile}`);
        }
        else if(imageName) {
            tl.debug("Deploying image " + imageName + " to the webapp " + this._appService.getName());
        }

        tl.debug("Updating the webapp configuration.");
        await this._updateConfigurationDetails(properties["ConfigurationSettings"], properties["StartupCommand"], isLinuxApp, imageName, isMultiContainer, updatedMulticontainerConfigFile);

        tl.debug('making a restart request to app service');
        await this._appService.restart();
    }

    private async _updateConfigurationDetails(configSettings: any, startupCommand: string, isLinuxApp: boolean, imageName?: string, isMultiContainer?: boolean, multicontainerConfigFile?: string): Promise<void> {
        var appSettingsNewProperties = !!configSettings ? parse(configSettings.trim()): { };
        appSettingsNewProperties.appCommandLine = {
            'value': startupCommand
        }

        if(isLinuxApp) {
            if(isMultiContainer) {
                let fileData = fs.readFileSync(multicontainerConfigFile);
                appSettingsNewProperties.linuxFxVersion = {
                    'value': "COMPOSE|" + (new Buffer(fileData).toString('base64'))
                }
            }
            else {
                appSettingsNewProperties.linuxFxVersion = {
                    'value': "DOCKER|" + imageName
                }
            }
        }
        else {
            appSettingsNewProperties.windowsFxVersion = {
                'value': "DOCKER|" + imageName
            }
        }

        tl.debug(`CONTAINER UPDATE CONFIG VALUES : ${JSON.stringify(appSettingsNewProperties)}`);
        await this._appServiceUtility.updateConfigurationSettings(appSettingsNewProperties);
    }

    private _getAzureContainerImageName(): string {
        var registry = tl.getInput('AzureContainerRegistryLoginServer', true) + ".azurecr.io";
        var image = tl.getInput('AzureContainerRegistryImage', true);
        var tag = tl.getInput('AzureContainerRegistryTag', false);
    
        return this._constructImageName(registry, image, tag);
    }

    private _getDockerHubImageName(): string {
        var namespace = tl.getInput('DockerNamespace', true);
        var image = tl.getInput('DockerRepository', true);
        var tag = tl.getInput('DockerImageTag', false);
    
        return this._constructImageName(namespace, image, tag);
    }

    private _constructImageName(namespace, repository, tag): string {
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
            imageName = namespace.toLowerCase() + "/" + repository.toLowerCase() + ":" + tag;
        } else {
            imageName = namespace.toLowerCase() + "/" + repository.toLowerCase();
        }
    
        return imageName.replace(/ /g,"");
    }

    private _getPrivateRegistryImageName(): string {
        var registryConnectedServiceName = tl.getInput('RegistryConnectedServiceName', true);
        var loginServer = tl.getEndpointAuthorizationParameter(registryConnectedServiceName, 'url', true);
    
        var registry = url.parse(loginServer).hostname;
        var image = tl.getInput('PrivateRegistryImage', true);
        var tag = tl.getInput('PrivateRegistryTag', false);
    
        return this._constructImageName(registry, image, tag);
    }

    private _updateWebAppSettings(appSettingsParameters, webAppSettings): void {
        // In case of public repo, clear the connection details of a registry
        var dockerRespositoryAccess = tl.getInput('DockerRepositoryAccess', true);
        
        // Uncomment the below lines while supprting all registry types.
        // if(dockerRespositoryAccess === "public")
        // {
        //     deleteRegistryConnectionSettings(webAppSettings);
        // }
        
        var parsedAppSettings = parse(appSettingsParameters);
        for (var settingName in parsedAppSettings) {
            var setting = settingName.trim();
            var settingVal = parsedAppSettings[settingName].value;
            settingVal = settingVal ? settingVal.trim() : "";
    
            if(setting) {
                webAppSettings["properties"][setting] = settingVal;
            }
        }
    }

    private _getImageName(): string {
        var registryType = tl.getInput('ImageSource', true);
        var imageName = null;
    
        switch(registryType) {        
            case registryTypes[registryTypes.AzureContainerRegistry]:
                imageName = this._getAzureContainerImageName();
                break;
    
            case registryTypes[registryTypes.Registry]:
                imageName = this._getDockerHubImageName();
                break;
    
            case registryTypes[registryTypes.PrivateRegistry]:
                imageName = this._getPrivateRegistryImageName();
                break;
        }
    
        return imageName;
    }

    private async _getContainerRegistrySettings(imageName, endPoint): Promise<string> {
        var containerRegistryType: string = 'Registry';
        var containerRegistrySettings: string = "-DOCKER_CUSTOM_IMAGE_NAME " + imageName;
        var containerRegistryAuthParamsFormatString: string = "-DOCKER_REGISTRY_SERVER_URL %s -DOCKER_REGISTRY_SERVER_USERNAME %s -DOCKER_REGISTRY_SERVER_PASSWORD %s";
    
        switch(containerRegistryType) {
            case registryTypes[registryTypes.AzureContainerRegistry]:
                containerRegistrySettings = await this._getAzureContainerRegistrySettings(endPoint, containerRegistrySettings, containerRegistryAuthParamsFormatString);
                break;
    
            case registryTypes[registryTypes.Registry]:
                var dockerRespositoryAccess = tl.getInput('DockerRepositoryAccess', false);
                if(dockerRespositoryAccess === "private")
                {
                    containerRegistrySettings = this._getDockerPrivateRegistrySettings(containerRegistrySettings, containerRegistryAuthParamsFormatString);
                }
                break;
    
            case registryTypes[registryTypes.PrivateRegistry]:
                containerRegistrySettings = this._getDockerPrivateRegistrySettings(containerRegistrySettings, containerRegistryAuthParamsFormatString);
                break;           
        }    
    
        return containerRegistrySettings;
    }

    private async _getAzureContainerRegistrySettings(endPoint, containerRegistrySettings, containerRegistryAuthParamsFormatString): Promise<string> {    
        var registryServerName = tl.getInput('AzureContainerRegistryLoginServer', true);
        var registryUrl = "https://" + registryServerName + ".azurecr.io";    
        tl.debug("Azure Container Registry Url: " + registryUrl);
    
        var registryName = tl.getInput('AzureContainerRegistry', true);
        var resourceGroupName = '';// await azureRESTUtility.getResourceGroupName(endPoint, registryName, "Microsoft.ContainerRegistry/registries");
        tl.debug("Resource group name of a registry: " + resourceGroupName);
    
        var creds = null //await azureRESTUtility.getAzureContainerRegistryCredentials(endPoint, registryName, resourceGroupName);
        tl.debug("Successfully retrieved the registry credentials");
    
        var username = creds.username;
        var password = creds["passwords"][0].value;
    
        return containerRegistrySettings + " " + util.format(containerRegistryAuthParamsFormatString, registryUrl, username, password);
    }
    
    private _getDockerPrivateRegistrySettings(containerRegistrySettings, containerRegistryAuthParamsFormatString): string {
        var registryConnectedServiceName = tl.getInput('RegistryConnectedServiceName', true);    
        var username = tl.getEndpointAuthorizationParameter(registryConnectedServiceName, 'username', true);
        var password = tl.getEndpointAuthorizationParameter(registryConnectedServiceName, 'password', true);    
        var registryUrl = tl.getEndpointAuthorizationParameter(registryConnectedServiceName, 'registry', true);
    
        tl.debug("Docker or Private Container Registry Url: " + registryUrl);
    
        return containerRegistrySettings + " " + util.format(containerRegistryAuthParamsFormatString, registryUrl, username, password);
    }

    private _deleteRegistryConnectionSettings(webAppSettings): void {
        delete webAppSettings["properties"]["DOCKER_REGISTRY_SERVER_URL"];
        delete webAppSettings["properties"]["DOCKER_REGISTRY_SERVER_USERNAME"];
        delete webAppSettings["properties"]["DOCKER_REGISTRY_SERVER_PASSWORD"];
    }

    private updateImagesInConfigFile(multicontainerConfigFile, images): string {
        const tempDirectory = deployUtility.getTempDirectory();
        var contents = fs.readFileSync(multicontainerConfigFile).toString();
        var imageList = images.split("\n");
        imageList.forEach((image: string) => {
            let imageName = image.split(":")[0];
            if (contents.indexOf(imageName) > 0) {
                contents = this.tokenizeImages(contents, imageName, image);
            }
        });

        let newFilePath = path.join(tempDirectory, path.basename(multicontainerConfigFile));
        fs.writeFileSync(
            path.join(newFilePath),
            contents
        );
        
        return newFilePath;
    }

    private tokenizeImages(currentString: string, imageName: string, imageNameWithNewTag: string) {
        let i = currentString.indexOf(imageName);
        if (i < 0) {
            tl.debug(`No occurence of replacement token: ${imageName} found`);
            return currentString;
        }

        let newString = "";
        currentString.split("\n")
            .forEach((line) => {
                if (line.indexOf(imageName) > 0 && line.toLocaleLowerCase().indexOf("image") > 0) {
                    let i = line.indexOf(imageName);
                    newString += line.substring(0, i);
                    let leftOverString = line.substring(i);
                    if (leftOverString.endsWith("\"")) {
                        newString += imageNameWithNewTag + "\"" + "\n";
                    } else {
                        newString += imageNameWithNewTag + "\n";
                    }
                }
                else {
                    newString += line + "\n";
                }
            });

        return newString;
    }
}