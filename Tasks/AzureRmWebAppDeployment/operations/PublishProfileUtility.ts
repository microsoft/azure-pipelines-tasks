import tl = require('vsts-task-lib/task');
import { TaskParameters } from './TaskParameters';
import fs = require('fs');
import * as Constant from './Constants';
import path = require('path');
import Q = require('q');

var packageUtility = require('webdeployment-common/packageUtility.js');
var parseString = require('xml2js').parseString;
const ERROR_FILE_NAME = "error.txt";

export class PublishProfileUtility {

    private _publishProfileJs: any = null;
    private _publishProfilePath: string;

    constructor(publishProfilePath: string) {
        this._publishProfilePath = publishProfilePath;
    }

    public async GetTaskParametersFromPublishProfileFile(taskParams: TaskParameters): Promise<any> {
        try {
            if(this._publishProfileJs === null) {
                this._publishProfileJs = await this.GetPublishProfileJsonFromFile();
            }
        } catch(error) {
            throw new Error(error);
        }
        var msDeployPublishingProfile: any = {};
        taskParams.WebAppName = this._publishProfileJs.DeployIisAppPath[0];
        taskParams.ExcludeFilesFromAppDataFlag = this._publishProfileJs.hasOwnProperty(Constant.PublishProfileXml.ExcludeApp_Data) ? this._publishProfileJs.ExcludeApp_Data[0] : false;
        taskParams.TakeAppOfflineFlag = this._publishProfileJs.hasOwnProperty(Constant.PublishProfileXml.EnableMSDeployAppOffline) ? this._publishProfileJs.EnableMSDeployAppOffline[0] : false;
        taskParams.RemoveAdditionalFilesFlag = this._publishProfileJs.hasOwnProperty(Constant.PublishProfileXml.SkipExtraFilesOnServer) ? this._publishProfileJs.SkipExtraFilesOnServer[0] : false
        msDeployPublishingProfile.publishUrl = this._publishProfileJs.MSDeployServiceURL[0];
        msDeployPublishingProfile.userName = this._publishProfileJs.UserName[0];
        msDeployPublishingProfile.userPWD = taskParams.PublishProfilePassword;
        return msDeployPublishingProfile;
    }

    public async GetPropertyValuefromPublishProfile(propertyKey: string): Promise<any> {
        try {
            if(this._publishProfileJs === null) {
                this._publishProfileJs = await this.GetPublishProfileJsonFromFile();
            }
        } catch(error) {
            throw new Error(error);
        }
        return new Promise ((response, reject) => {
            this._publishProfileJs.hasOwnProperty(propertyKey) ?
                response(this._publishProfileJs[propertyKey][0]) : reject(tl.loc('PropertyDoesntExistPublishProfile', propertyKey)); 
            });
    }

    private async GetPublishProfileJsonFromFile(): Promise<any> {
        return new Promise((response, reject) => {
            var pubxmlFile = packageUtility.PackageUtility.getPackagePath(this._publishProfilePath);
            var publishProfileXML = fs.readFileSync(pubxmlFile);
            parseString(publishProfileXML, (error, result) => {
                if(!!error) {
                    reject(tl.loc('XmlParsingFailed', error));
                }
                var propertyGroup = result && result.Project && result.Project.PropertyGroup ? result.Project.PropertyGroup : null;
                if(propertyGroup) {
                    for (var index in propertyGroup) {
                        if (propertyGroup[index] && propertyGroup[index].WebPublishMethod[0] === Constant.PublishProfileXml.MSDeploy) {
                            if(!propertyGroup[index].hasOwnProperty(Constant.PublishProfileXml.MSDeployServiceURL) 
                                || !propertyGroup[index].hasOwnProperty(Constant.PublishProfileXml.DeployIisAppPath) 
                                || !propertyGroup[index].hasOwnProperty(Constant.PublishProfileXml.UserName)) {
                                reject(tl.loc('InvalidPublishProfile'));
                            }
                            tl.debug("Publish Profile: " + JSON.stringify(propertyGroup[index]));
                            response(propertyGroup[index]);
                        }
                    }
                }
                reject(tl.loc('ErrorNoSuchDeployingMethodExists'));
            });
        });
    }
    
    public async RunCmd(cmdArgs) {
        var deferred = Q.defer();
        var cmdError = null;
        var errorFile = path.join(tl.getVariable('System.DefaultWorkingDirectory'), ERROR_FILE_NAME);
		var errObj = fs.createWriteStream(errorFile);
        errObj.on('finish', () => {
            if(cmdError) {
                deferred.reject(cmdError);
            }
        });

        try {
           await tl.exec("cmd", cmdArgs, <any>{
               errStream: errObj,
			   outStream: process.stdout,
			   failOnStdErr: true,
               windowsVerbatimArguments: true
             }).then(() => {
               deferred.resolve();
             }).catch((error) => {
                throw(error);
             });
        } catch (error) {
            cmdError = error;
        } finally {
            errObj.end();
        }

        return deferred.promise;
    }
}
