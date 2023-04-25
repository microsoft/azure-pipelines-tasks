import tl = require('azure-pipelines-task-lib/task');
import fs = require('fs');
import path = require('path');
var deployUtility = require('azure-pipelines-tasks-webdeployment-common/utility');
import { AzureAppService } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-app-service';
import { parse }  from 'azure-pipelines-tasks-webdeployment-common/ParameterParserUtility';

export class ContainerBasedDeploymentUtility {
    private _appService: AzureAppService;

    constructor(appService: AzureAppService) {
        this._appService = appService;
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
        await this._appService.updateConfigurationSettings(appSettingsNewProperties);
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