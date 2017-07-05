import Q = require('q');
import tl = require('vsts-task-lib/task');
import httpClient = require('vso-node-api/HttpClient');

var httpObj = new httpClient.HttpCallbackClient(tl.getVariable("AZURE_HTTP_USER_AGENT"));

export async function getInstalledExtensions(publishingProfile) {
    var defer = Q.defer();
    var kuduPhysicalpathUrl = "https://" + publishingProfile.publishUrl + "/api/siteextensions/";
    var basicAuthToken = 'Basic ' + new Buffer(publishingProfile.userName + ':' + publishingProfile.userPWD).toString('base64');
    var headers = {
        'Authorization': basicAuthToken,
        'If-Match': "*"
    };
    var installedExtensionsList = {};
    tl.debug('Request to retrieve list of extensions already available in Azure App Service: ' + kuduPhysicalpathUrl);
    httpObj.get('GET', kuduPhysicalpathUrl, headers, (error, response, body) => {
        if(error) {
            console.log(body);
            defer.reject(tl.loc('ExtensionListFailedError', error.toString()));
        }
        else if(response.statusCode === 200) {
            tl.debug('Retrieved list of extensions already available in Azure App Service.');
            var extensionsList = JSON.parse(body);
            for(var extension of extensionsList) {
                tl.debug('* ' + extension['id']);
                installedExtensionsList[extension['id']] = extension;
            }
            defer.resolve(installedExtensionsList);
        }
        else {
            console.log(body);
            defer.reject(tl.loc('ExtensionListFailedResponseError', response.statusCode, response.statusMessage));
        }
    });
    return defer.promise;
}

export async function installExtension(publishingProfile, extension: string) {
    var defer = Q.defer();
    var kuduPhysicalpathUrl = "https://" + publishingProfile.publishUrl + "/api/siteextensions/" + extension;
    var basicAuthToken = 'Basic ' + new Buffer(publishingProfile.userName + ':' + publishingProfile.userPWD).toString('base64');
    var headers = {
        'Authorization': basicAuthToken,
        'If-Match': "*"
    };
    tl.debug('Requesting to install extension: ' + extension + ' using api: ' + kuduPhysicalpathUrl);
    console.log(tl.loc('InstallingSiteExtension', extension));
    httpObj.get('PUT', kuduPhysicalpathUrl, headers, (error, response, body) => {
        if(error) {
            defer.reject(tl.loc('ExtensionInstallFailedError', extension, error.toString()));
        }
        else if(response.statusCode === 200) {
            tl.debug(body);
            var responseBody = JSON.parse(body);
            console.log(tl.loc('ExtensionInstallSuccess', responseBody['title']));
            defer.resolve(responseBody);
        }
        else {
            console.log(body);
            defer.reject(tl.loc('ExtensionInstallFailedResponseError', extension, response.statusCode, response.statusMessage));
        }

    });
    return defer.promise;
}

export async function installExtensions(publishingProfile, extensions: Array<string>, extensionOutputVariables: Array<string>) {

    var outputVariableCount = 0;
    var outputVariableSize = extensionOutputVariables.length;
    var InstalledExtensions = await getInstalledExtensions(publishingProfile);
    var extensionInfo = null;
    var anyExtensionInstalled = false;
    for(var extension of extensions) {
        extension = extension.trim();
        if(InstalledExtensions[extension]) {
            extensionInfo = InstalledExtensions[extension];
            console.log(tl.loc('ExtensionAlreadyAvaiable', extensionInfo['title']));
        }
        else {
            tl.debug("Extension '" + extension + "' not installed. Installing...");
            extensionInfo = await installExtension(publishingProfile, extension);
            anyExtensionInstalled = true;
        }
        if(outputVariableCount < outputVariableSize) {
            var extensionLocalPath: string = getExtensionLocalPath(extensionInfo);
            tl.debug('Set Variable ' + extensionOutputVariables[outputVariableCount] + ' to value: ' + extensionLocalPath);
            tl.setVariable(extensionOutputVariables[outputVariableCount], extensionLocalPath);
            outputVariableCount += 1;
        }
    }
    return anyExtensionInstalled;
}

function getExtensionLocalPath(extensionInfo: JSON): string {
    var extensionId: string = extensionInfo['id'];
    var homeDir = "D:\\home\\";

    if(extensionId.startsWith('python2')) {
        return homeDir + "Python27";
    }
    else if(extensionId.startsWith('python351') || extensionId.startsWith('python352')) {
        return homeDir + "Python35";
    }
    else if(extensionId.startsWith('python3')) {
        return homeDir + extensionId;
    }
    else {
        return extensionInfo['local_path'];
    }
}