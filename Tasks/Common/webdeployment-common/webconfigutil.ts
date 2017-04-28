import tl = require('vsts-task-lib/task');
import fs = require('fs');
import path = require('path');

export function generateWebConfigFile(webConfigTargetPath: string, appType: string, substitutionParameters: any) {
    // Get the template path for the given appType
    var webConfigTemplatePath = path.join(__dirname, 'WebConfigTemplates', appType.toLowerCase());
    var webConfigContent: string = fs.readFileSync(webConfigTemplatePath, 'utf8');
    webConfigContent = replaceMultiple(webConfigContent, substitutionParameters);
    tl.writeFile(webConfigTargetPath, webConfigContent, { encoding: "utf8" });
}

function replaceMultiple(text: string, substitutions: any): string {
    for(var key in substitutions) {
        tl.debug('Replacing: ' + '{' + key + '} with: ' + substitutions[key].value);
        text = text.replace(new RegExp('{' + key + '}', 'g'), substitutions[key].value);
    }
    return text;
}

export function addWebConfigFile(folderPath: any, webConfigParameters, rootDirectoryPath: string) {
    //Generate the web.config file if it does not already exist.
    var webConfigPath = path.join(folderPath, "web.config");
    if (!tl.exist(webConfigPath)) {
        tl.debug('web.config file does not exist. Generating.');
        if(!webConfigParameters || !webConfigParameters['appType']) {
            throw new Error(tl.loc("FailedToGenerateWebConfig", tl.loc("MissingWebConfigParameters")));
        }
        var appType: string = webConfigParameters['appType'].value;
        delete webConfigParameters['appType'];
        if(appType != "node") {
            rootDirectoryPath = "D:\\home\\" + (rootDirectoryPath ? rootDirectoryPath : "site\\wwwroot");
            tl.debug('Root Directory path to be set on web.config: ' + rootDirectoryPath);
            webConfigParameters['KUDU_WORKING_DIRECTORY'] = {
                value: rootDirectoryPath
            };
        }
        if(appType === 'python_Django' && webConfigParameters['DJANGO_SETTINGS_MODULE'].value === '') {
            tl.debug('Auto detecting settings.py to set DJANGO_SETTINGS_MODULE...');
            webConfigParameters['DJANGO_SETTINGS_MODULE'] = {
                value: getDjangoSettingsFile(folderPath)
            };
        }
        try {
            // Create web.config
            generateWebConfigFile(webConfigPath, appType, webConfigParameters);
            console.log(tl.loc("SuccessfullyGeneratedWebConfig"));
        }
        catch (error) {
            throw new Error(tl.loc("FailedToGenerateWebConfig", error));
        }
    }
    else {
        console.log(tl.loc('WebConfigAlreadyExists'));
    }
}


function getDjangoSettingsFile(folderPath: string) {
    var listDirFiles = tl.ls('', [folderPath]);
    for(var listDirFile of listDirFiles) {
        tl.debug('Searching for settings.py in ' + path.join(folderPath, listDirFile));
        if(!tl.stats(path.join(folderPath, listDirFile)).isFile() && tl.exist(path.join(folderPath, listDirFile, 'settings.py'))) {
            tl.debug('Found DJANGO_SETTINGS_MODULE in ' + listDirFile + ' folder');
            return listDirFile + '.settings';
        }
    }
    throw tl.loc('AutoDetectDjangoSettingsFailed');
}