import tl = require('azure-pipelines-task-lib/task');
import fs = require('fs');
import path = require('path');
import util = require('util');

export function generateWebConfigFile(webConfigTargetPath: string, appType: string, substitutionParameters: any) {
    // Get the template path for the given appType
    var webConfigTemplatePath = path.join(__dirname, '../WebConfigTemplates', appType.toLowerCase());
    var webConfigContent: string = fs.readFileSync(webConfigTemplatePath, 'utf8');
    webConfigContent = replaceMultiple(webConfigContent, substitutionParameters);
    tl.writeFile(webConfigTargetPath, webConfigContent, { encoding: "utf8" });
}

function replaceMultiple(text: string, substitutions: any): string {
    for(var key in substitutions) {
        tl.debug('Replacing: ' + '{' + key + '} with: ' + substitutions[key]);
        text = text.replace(new RegExp('{' + key + '}', 'g'), substitutions[key]);
    }
    return text;
}

function addMissingParametersValue(appType: string, webConfigParameters) {
    var paramDefaultValue = {
        'node': {
            'Handler': 'iisnode',
            'NodeStartFile': 'server.js'
        },
        'python_Bottle': {
            'WSGI_HANDLER': 'app.wsgi_app()',
            'PYTHON_PATH': 'D:\\home\\python353x86\\python.exe',
            'PYTHON_WFASTCGI_PATH': 'D:\\home\\python353x86\\wfastcgi.py'
        },
        'python_Django': {
            'WSGI_HANDLER': 'django.core.wsgi.get_wsgi_application()',
            'PYTHON_PATH': 'D:\\home\\python353x86\\python.exe',
            'PYTHON_WFASTCGI_PATH': 'D:\\home\\python353x86\\wfastcgi.py',
            'DJANGO_SETTINGS_MODULE': ''
        },
        'python_Flask': {
            'WSGI_HANDLER': 'main.app',
            'PYTHON_PATH': 'D:\\home\\python353x86\\python.exe',
            'PYTHON_WFASTCGI_PATH': 'D:\\home\\python353x86\\wfastcgi.py',
            'STATIC_FOLDER_PATH': 'static'
        },
        'Go': {
            'GoExeFilePath': ''
        },
        'java_springboot': {
            'JAVA_PATH' : '%JAVA_HOME%\\bin\\java.exe',
            'JAR_PATH' : '',
            'ADDITIONAL_DEPLOYMENT_OPTIONS' : ''
        }
    };

    var selectedAppTypeParams = paramDefaultValue[appType];
    var resultAppTypeParams = {};
    for(var paramAtttribute in selectedAppTypeParams) {
        if(webConfigParameters[paramAtttribute]) {
            tl.debug("param Attribute'" + paramAtttribute + "' values provided as: " + webConfigParameters[paramAtttribute].value);
            resultAppTypeParams[paramAtttribute] = webConfigParameters[paramAtttribute].value;
        }
        else {
            tl.debug("param Attribute '" + paramAtttribute + "' is not provided. Overriding the value with '" + selectedAppTypeParams[paramAtttribute]+ "'");
            resultAppTypeParams[paramAtttribute] = selectedAppTypeParams[paramAtttribute];
        }
    }
    return resultAppTypeParams;
}
export function addWebConfigFile(folderPath: any, webConfigParameters, rootDirectoryPath: string) {
    //Generate the web.config file if it does not already exist.
    var webConfigPath = path.join(folderPath, "web.config");
    if (!tl.exist(webConfigPath)) {
        try {
            var supportedAppTypes = ['node', 'python_Bottle', 'python_Django', 'python_Flask', 'Go', 'java_springboot']
            // Create web.config
            tl.debug('web.config file does not exist. Generating.');
            if(!webConfigParameters['appType']) {
                throw new Error(tl.loc("MissingAppTypeWebConfigParameters"));
            }

            var appType: string = webConfigParameters['appType'].value;
            if(supportedAppTypes.indexOf(appType) === -1) {
                throw Error(tl.loc('UnsupportedAppType', appType));
            }
            tl.debug('Generating Web.config file for App type: ' + appType);
            delete webConfigParameters['appType'];

            var selectedAppTypeParams = addMissingParametersValue(appType, webConfigParameters);
            if(appType.startsWith("python")) {
                tl.debug('Root Directory path to be set on web.config: ' + rootDirectoryPath);
                selectedAppTypeParams['KUDU_WORKING_DIRECTORY'] = rootDirectoryPath;
                if(appType === 'python_Django' && webConfigParameters['DJANGO_SETTINGS_MODULE'].value === '') {
                    tl.debug('Auto detecting settings.py to set DJANGO_SETTINGS_MODULE...');
                    selectedAppTypeParams['DJANGO_SETTINGS_MODULE'] = getDjangoSettingsFile(folderPath);
                }
            } else if(appType == 'Go') {
                if (util.isNullOrUndefined(webConfigParameters['GoExeFileName'])
                        || util.isNullOrUndefined(webConfigParameters['GoExeFileName'].value) 
                        || webConfigParameters['GoExeFileName'].value.length <=0) {
                    throw Error(tl.loc('GoExeNameNotPresent'));
                }
                selectedAppTypeParams['GoExeFilePath'] = rootDirectoryPath + "\\" + webConfigParameters['GoExeFileName'].value;
            } else if(appType == 'java_springboot') {
                if (util.isNullOrUndefined(webConfigParameters['JAR_PATH'])
                || util.isNullOrUndefined(webConfigParameters['JAR_PATH'].value) 
                || webConfigParameters['JAR_PATH'].value.length <= 0) {
                    throw Error(tl.loc('JarPathNotPresent'));
                }
                selectedAppTypeParams['JAR_PATH'] = rootDirectoryPath + "\\" + webConfigParameters['JAR_PATH'].value;
            }

            generateWebConfigFile(webConfigPath, appType, selectedAppTypeParams);
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