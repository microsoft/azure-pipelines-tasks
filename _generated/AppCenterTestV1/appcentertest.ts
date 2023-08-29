import path = require('path');
import tl = require('azure-pipelines-task-lib/task');
import apim = require('azure-devops-node-api');
import * as lim from 'azure-devops-node-api/interfaces/LocationsInterfaces';
import os = require('os');

import { ToolRunner } from 'azure-pipelines-task-lib/toolrunner';

var utils = require('./utils.js');

const testRunIdLineRegexp = /Test run id: "([^"]+)"/;

function getEndpointAPIToken(endpointInputFieldName) {
    var errorMessage = tl.loc("CannotDecodeEndpoint");
    var endpoint = tl.getInput(endpointInputFieldName, true);

    if (!endpoint) {
        throw new Error(errorMessage);
    }

    let authToken = tl.getEndpointAuthorizationParameter(endpoint, 'apitoken', false);

    return authToken;
}

function resolveInputPatternToOneFile(inputName: string, required: boolean, name: string): string {
    let pattern = tl.getInput(inputName, required);
    if (!pattern) {
        return null;
    }

    let resolved = utils.resolveSinglePath(pattern);
    tl.checkPath(resolved, name);

    return resolved;
}

function addArg(argName: string, getInput: () => string, tr: ToolRunner) {
    let arg = getInput();
    if (arg) {
        tr.arg([argName, arg]);
    }
}

function addStringArg(argName: string, inputName: string, required: boolean, tr: ToolRunner) {
    addArg(argName, () => { return tl.getInput(inputName, required) }, tr);
}

function addBooleanArg(argName: string, inputName: string, tr: ToolRunner) {
    let booleanArg = tl.getBoolInput(inputName, false);
    if (booleanArg) {
        tr.arg(argName);
    }
}

function addOptionalWildcardArg(argName: string, inputName: string, tr: ToolRunner) {
    addArg(argName, () => { return resolveInputPatternToOneFile(inputName, false, inputName) }, tr);
}

function getCliPath(): string {
    let userDefinedPath = tl.getInput("cliLocationOverride", false);
    if (utils.checkAndFixFilePath(userDefinedPath, "cli path")) {
        return userDefinedPath;
    }

    let systemPath = tl.which('appcenter', false);
    if (systemPath) {
        return systemPath;
    }

    // On Windows (Hosted Agent) we attempt to use the bundled appcenter cli as user doesn't have any
    // chance to install the CLI themselves.  On Mac the bundled appcenter does not work due to some
    // path issues.
    let isWindows = os.type().match(/^Win/);
    if (isWindows) {
        let cliPath = path.join(__dirname, "node_modules", ".bin", "appcenter.cmd");
        return cliPath;
    }

    // Failed to locate CLI
    throw new Error(tl.loc('CannotLocateAppCenterCLI'));;
}

function getPrepareRunner(cliPath: string, debug: boolean, app: string, artifactsDir: string): ToolRunner {
    // Get Test Prepare inputs
    let prepareRunner = tl.tool(cliPath);
    let framework: string = tl.getInput('framework', true);

    // framework agnositic options 
    prepareRunner.arg(['test', 'prepare', framework]);
    prepareRunner.arg(['--artifacts-dir', artifactsDir]);

    // framework specific options -- appium
    if (framework === 'appium') {
        addStringArg('--build-dir', 'appiumBuildDir', true, prepareRunner);
    } else if (framework === 'espresso') {
        addStringArg('--build-dir', 'espressoBuildDir', false, prepareRunner);
        addOptionalWildcardArg('--test-apk-path', 'espressoTestApkPath', prepareRunner);
    } else if (framework === 'calabash') {
        prepareRunner.arg(['--app-path', app]);
        addStringArg('--project-dir', 'calabashProjectDir', true, prepareRunner);
        addStringArg('--sign-info', 'signInfo', false, prepareRunner);
        if (tl.filePathSupplied('calabashConfigFile')) {
            addStringArg('--config-path', 'calabashConfigFile', false, prepareRunner);
        }
        addStringArg('--profile', 'calabashProfile', false, prepareRunner);
        addBooleanArg('--skip-config-check', 'calabashSkipConfigCheck', prepareRunner);
    } else if (framework === 'uitest') {
        prepareRunner.arg(['--app-path', app]);
        addStringArg('--build-dir', 'uitestBuildDir', true, prepareRunner);
        addStringArg('--store-path', 'uitestStorePath', false, prepareRunner);
        addStringArg('--store-password', 'uitestStorePass', false, prepareRunner);
        addStringArg('--key-alias', 'uitestKeyAlias', false, prepareRunner);
        addStringArg('--key-password', 'uitestKeyPass', false, prepareRunner);
        addStringArg('--uitest-tools-dir', 'uitestToolsDir', false, prepareRunner);
        addStringArg('--sign-info', 'signInfo', false, prepareRunner);
    } else if (framework === 'xcuitest') {
        addStringArg('--build-dir', 'xcuitestBuildDir', false, prepareRunner);
        addStringArg('--test-ipa-path', 'xcuitestTestIpaPath', false, prepareRunner);
    }

    // append user defined inputs
    let prepareOpts = tl.getInput('prepareOpts', false);
    if (prepareOpts) {
        prepareRunner.line(prepareOpts);
    }

    if (debug) {
        prepareRunner.arg('--debug');
    }
    prepareRunner.arg('--quiet');

    return prepareRunner;
}

function getLoginRunner(cliPath: string, debug: boolean, credsType: string): ToolRunner {
    let loginRunner = tl.tool(cliPath);

    if (credsType === 'inputs') {
        let username: string = tl.getInput('username', true);
        let password: string = tl.getInput('password', true);

        loginRunner.arg(['login', '-u', username, '-p', password]);
        if (debug) {
            loginRunner.arg('--debug');
        }

        let loginOpts = tl.getInput('loginOpts', false);
        if (loginOpts) {
            loginRunner.line(loginOpts);
        }

        loginRunner.arg('--quiet');
    }

    return loginRunner;
}

function getTestRunner(cliPath: string, debug: boolean, app: string, artifactsDir: string, credsType: string): ToolRunner {
    let testRunner = tl.tool(cliPath);
    let appSlug: string = tl.getInput('appSlug', true);

    testRunner.arg(['test', 'run', 'manifest']);
    testRunner.arg(['--manifest-path', `${path.join(artifactsDir, 'manifest.json')}`]);
    testRunner.arg(['--app-path', app, '--app', appSlug]);

    addStringArg('--devices', 'devices', true, testRunner);
    addStringArg('--test-series', 'series', false, testRunner);
    addStringArg('--dsym-dir', 'dsymDir', false, testRunner);
    addBooleanArg('--async', 'async', testRunner);

    let locale: string = tl.getInput('locale', true);
    if (locale === 'user') {
        tl.debug('Use user defined locale.');
        locale = tl.getInput('userDefinedLocale', true);
    }
    testRunner.arg(['--locale', locale]);

    let runOptions: string = tl.getInput('runOpts', false);
    if (runOptions) {
        testRunner.line(runOptions);
    }
    if (debug) {
        testRunner.arg('--debug');
    }
    testRunner.arg('--quiet');
    if (credsType === 'serviceEndpoint') {
        // add api key
        let apiToken = getEndpointAPIToken('serverEndpoint');
        testRunner.arg(['--token', apiToken]);
    }

    testRunner.on('stdline', line => {
        let match = testRunIdLineRegexp.exec(line);
        if (match) {
            setTestRunIdBuildPropertyAsync(match[1]);
        }
    });

    return testRunner;
}

async function setTestRunIdBuildPropertyAsync(testRunId: string) {
    try {
        let url = tl.getEndpointUrl('SYSTEMVSSCONNECTION', false);
        let token = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'ACCESSTOKEN', false);
        let projectId = tl.getVariable('System.TeamProjectId');
        let buildId = tl.getVariable('Build.BuildId');
        let auth = token.length == 52 ? apim.getPersonalAccessTokenHandler(token) : apim.getBearerHandler(token);
        let vsts: apim.WebApi = new apim.WebApi(url, auth);
        let conn: lim.ConnectionData = await vsts.connect();
        let buildApi = await vsts.getBuildApi();

        let patch = [
            {
                op: "replace",
                path: "/mobile-center-test-run-id",
                value: testRunId
            }
        ];

        await buildApi.updateBuildProperties(null, patch, projectId, parseInt(buildId));
    }
    catch (err) {
        tl.warning(`Cannot set build property /mobile-center/test-run-id: ${err}`);
    }
}

async function run() {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    let cliPath = getCliPath();
    let loggedIn = false;
    let testRunId: string = null;

    try {
        tl.checkPath(cliPath, "CLI for Visual Studio App Center");

        let debug: boolean = tl.getBoolInput('debug', false);
        let prepareTests: boolean = tl.getBoolInput('enablePrepare', false);
        let runTests: boolean = tl.getBoolInput('enableRun', false);
        let artifactsDir = tl.getInput('artifactsDir', true);
        let credsType = tl.getInput('credsType', true);

        // Get app info
        let app = resolveInputPatternToOneFile('app', true, "Binary File");

        // Test prepare
        if (prepareTests) {
            let prepareRunner = getPrepareRunner(cliPath, debug, app, artifactsDir);
            await prepareRunner.exec();
        }

        // Test run
        if (runTests) {
            // login if necessary
            if (credsType === 'inputs') {
                let loginRunner = getLoginRunner(cliPath, debug, credsType);
                await loginRunner.exec();
                loggedIn = true;
            }

            let testRunner = getTestRunner(cliPath, debug, app, artifactsDir, credsType);
            await testRunner.exec();
        }

        tl.setResult(tl.TaskResult.Succeeded, tl.loc("Succeeded"));
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, `${err}`);
    } finally {
        if (tl.exist(cliPath) && loggedIn) {
            // logout
            let logoutRunner = tl.tool(cliPath);
            logoutRunner.arg(['logout', '--quiet']);

            await logoutRunner.exec();
        }
    }
}

run();
