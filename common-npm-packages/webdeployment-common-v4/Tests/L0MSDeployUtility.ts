var msdeployUtility = require('azure-pipelines-tasks-webdeployment-common-v4/msdeployutility.js');

var errorMessages = {
    'ERROR_INSUFFICIENT_ACCESS_TO_SITE_FOLDER': 'ERROR_INSUFFICIENT_ACCESS_TO_SITE_FOLDER',
    "An error was encountered when processing operation 'Delete Directory' on 'D:\\home\\site\\wwwroot\\app_data\\jobs\\continous'": "WebJobsInProgressIssue",
    "Cannot delete file main.dll. Error code: FILE_IN_USE": "FILE_IN_USE",
    "transport connection": "transport connection",
    "error code: ERROR_CONNECTION_TERMINATED": "ERROR_CONNECTION_TERMINATED"
}

function checkParametersIfPresent(argumentString: string, argumentCheckArray: Array<string>) {
    for(var argument of argumentCheckArray) {
        if(argumentString.indexOf(argument) == -1) {
            return false;
        }
    }

    return true;
}

var defaultMSBuildPackageArgument: string = msdeployUtility.getMSDeployCmdArgs('package.zip', 'webapp_name', {
    publishUrl: 'http://webapp_name.scm.azurewebsites.net:443', userName: '$webapp_name', userPWD: 'webapp_password'
}, true, false, true, null, null, null, true, false, false);

console.log(` * MSBUILD DEFAULT PARAMS: ${defaultMSBuildPackageArgument}`);
if(checkParametersIfPresent(defaultMSBuildPackageArgument, ["-source:package=\"'package.zip'\"", 
    " -dest:auto,ComputerName=\"'https://http://webapp_name.scm.azurewebsites.net:443/msdeploy.axd?site=webapp_name'\",UserName=\"'$webapp_name'\",Password=\"'webapp_password'\",AuthType=\"'Basic'\"",
    " -setParam:name=\"'IIS Web Application Name'\",value=\"'webapp_name'\"", '-enableRule:AppOffline']) && defaultMSBuildPackageArgument.indexOf('-setParamFile') == -1) {
    console.log("MSBUILD DEFAULT PARAMS PASSED");
}
else {
    throw new Error('MSBUILD PACKAGE DEFAULT PARAMS FAILED');
}


var packageWithSetParamArgument: string = msdeployUtility.getMSDeployCmdArgs('package.zip', 'webapp_name', {
    publishUrl: 'http://webapp_name.scm.azurewebsites.net:443', userName: '$webapp_name', userPWD: 'webapp_password'
}, false, false, true, null, 'temp_param.xml', null, false, false, true);


console.log(` * PACKAGE WITh SET PARAMS: ${packageWithSetParamArgument}`);


if(checkParametersIfPresent(packageWithSetParamArgument, ['-setParamFile=temp_param.xml', "-dest:contentPath=\"'webapp_name'\"" , '-enableRule:DoNotDelete'])) {
    console.log('ARGUMENTS WITH SET PARAMS PASSED');
}
else {
    throw Error('ARGUMENTS WITH SET PARAMS FAILED');
}

var folderPackageArgument: string = msdeployUtility.getMSDeployCmdArgs('c:/package/folder', 'webapp_name', {
    publishUrl: 'http://webapp_name.scm.azurewebsites.net:443', userName: '$webapp_name', userPWD: 'webapp_password'
}, true, false, true, null, null, null, true, true, true);

console.log(` * ARGUMENT WITh FOLDER AS PACKAGE: ${folderPackageArgument}`);
if(checkParametersIfPresent(folderPackageArgument, [
 "-source:IisApp=\"'c:/package/folder'\"",
 " -dest:iisApp=\"'webapp_name'\""
])) {
    console.log('ARGUMENT WITH FOLDER PACKAGE PASSED');
}
else {
    throw Error('ARGUMENT WITH FOLDER PACKAGE FAILED');
}


var packageWithExcludeAppDataArgument: string = msdeployUtility.getMSDeployCmdArgs('package.zip', 'webapp_name', {
    publishUrl: 'http://webapp_name.scm.azurewebsites.net:443', userName: '$webapp_name', userPWD: 'webapp_password'
}, false, true, true, null, null, null, false, false, true);

console.log(` * ARGUMENT WITh FOLDER AS PACKAGE: ${packageWithExcludeAppDataArgument}`);

if(checkParametersIfPresent(packageWithExcludeAppDataArgument, ['-skip:Directory=App_Data'])) {
    console.log('ARGUMENT WITH EXCLUDE APP DATA PASSED');
}
else {
    throw new Error('ARGUMENT WITH EXCLUDE APP DATA FAILED');   
}


var warDeploymentArgument: string =  msdeployUtility.getMSDeployCmdArgs('package.war', 'webapp_name', {
    publishUrl: 'http://webapp_name.scm.azurewebsites.net:443', userName: '$webapp_name', userPWD: 'webapp_password'
}, false, true, true, null, null, null, false, false, true);

console.log(` * ARGUMENT WITh WAR FILE AS PACKAGE: ${warDeploymentArgument}`);
if(checkParametersIfPresent(warDeploymentArgument, [
    " -source:contentPath=\"'package.war'\"",
    " -dest:contentPath=\"'/site/webapps/package.war'\""
])) {
    console.log('ARGUMENT WITH WAR PACKAGE PASSED');
}
else {
    throw new Error('ARGUMENT WITH WAR PACKAGE FAILED');
}

var overrideRetryArgument: string = msdeployUtility.getMSDeployCmdArgs('package.zip', 'webapp_name', {
    publishUrl: 'http://webapp_name.scm.azurewebsites.net:443', userName: '$webapp_name', userPWD: 'webapp_password'
}, false, true, true, null, null, '-retryAttempts:11 -retryInterval:5000', false, false, true);

console.log(` * ARGUMENTS WITH WAR FILE: ${overrideRetryArgument}`);

if(checkParametersIfPresent(overrideRetryArgument, ['-retryAttempts:11', '-retryInterval:5000'])) {
    console.log('ARGUMENT WITH OVERRIDE RETRY FLAG PASSED');
}
else {
    throw new Error('ARGUMENT WITH OVERRIDE RETRY FLAG FAILED');
}

// msdeployutility getWebDeployErrorCode
for(var errorMessage in errorMessages) {
    if(msdeployUtility.getWebDeployErrorCode(errorMessage) != errorMessages[errorMessage]) {
        throw new Error('MSDEPLOY getWebDeployErrorCode failed');
    }
}

console.log('MSDEPLOY getWebDeployErrorCode passed');
