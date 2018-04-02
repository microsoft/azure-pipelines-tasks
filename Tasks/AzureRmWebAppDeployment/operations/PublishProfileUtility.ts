import tl = require('vsts-task-lib/task');
import { TaskParameters } from './TaskParameters';
import fs = require('fs');
import * as Constant from './Constants';

var packageUtility = require('webdeployment-common/packageUtility.js');
var parseString = require('xml2js').parseString;

export class PublishProfileUtility {

    private static async GetPublishProfileJsonFromFile(publishProfilePath: string): Promise<any> {
        return new Promise((response, reject) => {
            var pubxmlFile = packageUtility.PackageUtility.getPackagePath(publishProfilePath);
            var publishProfileXML = fs.readFileSync(pubxmlFile);
            parseString(publishProfileXML, (error, result) => {
                if(!!error) {
                    reject(error);
                }
                var propertyGroup = result && result.Project && result.Project.PropertyGroup ? result.Project.PropertyGroup : null;
                if(propertyGroup) {
                    for (var index in propertyGroup) {
                        if (propertyGroup[index] && propertyGroup[index].WebPublishMethod[0] === "MSDeploy") {
                            response(propertyGroup[index]);
                        }
                    }
                }
                reject(tl.loc('ErrorNoSuchDeployingMethodExists'));
            });
        });
    }

    public static async GetTaskParametersFromPublishProfileFile(taskParams: TaskParameters): Promise<any> {
        try {
            var publishProfileJs = await PublishProfileUtility.GetPublishProfileJsonFromFile(taskParams.PublishProfilePath);
            if(!publishProfileJs.hasOwnProperty("MSDeployServiceURL")) {
                throw new Error("MSDeployServiceURL not found in publish profile");
            }
            tl.debug("Publish Profile: " + publishProfileJs);
            var msDeployPublishingProfile: any = {};
            taskParams.WebAppName = (publishProfileJs.MSDeployServiceURL[0] as string).split(".")[0];
            taskParams.ExcludeFilesFromAppDataFlag = publishProfileJs.hasOwnProperty(Constant.PublishProfileXml.ExcludeApp_Data) ? publishProfileJs.ExcludeApp_Data[0] : false;
            taskParams.TakeAppOfflineFlag = publishProfileJs.hasOwnProperty(Constant.PublishProfileXml.EnableMSDeployAppOffline) ? publishProfileJs.EnableMSDeployAppOffline[0] : false;
            taskParams.RemoveAdditionalFilesFlag = publishProfileJs.hasOwnProperty(Constant.PublishProfileXml.SkipExtraFilesOnServer) ? publishProfileJs.SkipExtraFilesOnServer[0] : false
            msDeployPublishingProfile.publishUrl = publishProfileJs.MSDeployServiceURL[0];
            msDeployPublishingProfile.userName = publishProfileJs.UserName[0];
            msDeployPublishingProfile.userPWD = taskParams.PublishProfilePassword;
            return msDeployPublishingProfile;
        } catch(error) {
            throw new Error(error);
        }
    }
}

