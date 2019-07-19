import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import taskLib = require('azure-pipelines-task-lib/task');
import fs = require('fs');
import os = require('os');
import path = require('path');
import { IRequestOptions } from 'typed-rest-client/Interfaces';
import { IRestResponse } from 'typed-rest-client/RestClient';

export class MockResponse<T> implements IRestResponse<T> {
    constructor(
      public result: T | null,
      public statusCode: number
    ) {
    }
  }

const proxyUrl = 'http://url.com';
const proxyUsername = 'username';
const proxyPassword = 'password';

let taskPath = path.join(__dirname, '..', 'usenode.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "assertAgent": {
        "2.115.1": true
    }
};
tmr.setAnswers(a);


//Create assertAgent and getVariable mocks
const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.getInput = function(inputName: string, required?: boolean) {
    inputName = inputName.toLowerCase();
    if (inputName === 'version') {
        return '11.3.0';
    }
    if (inputName === 'checkLatest') {
        return 'false';
    }
    return tl.getInput(inputName, required);
}
tlClone.getVariable = function(variable: string) {
    if (variable.toLowerCase() == 'agent.tempdirectory') {
        return 'temp';
    }
    return null;
};
tlClone.assertAgent = function(variable: string) {
    return;
};
tlClone.setSecret = function(password) {
    console.log('Setting secret', password);
};
tlClone.setVariable = function(key, val) {
    console.log('Setting', key, 'to', val);
};

if (process.env["__proxy__"]) {
    tlClone.getHttpProxyConfiguration = function(requestUrl?: string): taskLib.ProxyConfiguration | null {

        const fakeProxyConfiguration: taskLib.ProxyConfiguration = {
            proxyUrl: proxyUrl,
            proxyUsername: proxyUsername,
            proxyPassword: proxyPassword,
            proxyBypassHosts: null
        };

        console.log(`Using fake proxy proxyUrl: ${fakeProxyConfiguration.proxyUrl}, proxyUsername: ${fakeProxyConfiguration.proxyUsername}, proxyPassword: ${fakeProxyConfiguration.proxyPassword}`);

        return fakeProxyConfiguration;
    };
}
tmr.registerMock('azure-pipelines-task-lib/mock-task', tlClone);

const restm = require('typed-rest-client/RestClient');
const restmClone = Object.assign({}, restm);
if (process.env["__proxy__"]) {

    restmClone.get = function <T>(resource: string, options?: IRequestOptions): Promise<IRestResponse<T>> {
        validateResource(resource);
        validateOptions(options);
        try {
            let response = Promise.resolve(new MockResponse(null, 404));
            return response;
        } catch (e) {
            console.log(`Failed to get a resource ${resource}`, e);
        }
    }
};
tmr.registerMock('typed-rest-client/RestClient', restmClone);

//Create tool-lib mock
tmr.registerMock('vsts-task-tool-lib/tool', {
    isExplicitVersion: function(versionSpec) {
        return false;
    },
    findLocalTool: function(toolName, versionSpec) {
        if (toolName != 'node') {
            throw new Error('Searching for wrong tool');
        }
        return false;
    },
    evaluateVersions: function(versions, versionSpec) {
        let version: string;
        for (let i = versions.length - 1; i >= 0; i--) {
            let potential: string = versions[i];
            let satisfied: boolean = potential === 'v11.3.0';
            if (satisfied) {
                version = potential;
                break;
            }
        }
        return version;
    },
    cleanVersion: function(version) {
        return '11.3.0';
    },
    downloadTool(url) {
        if (url === `https://nodejs.org/dist/v11.3.0/node-v11.3.0-win-${os.arch()}.7z` ||
            url === `https://nodejs.org/dist/v11.3.0/node-v11.3.0-${os.platform()}-${os.arch()}.tar.gz`) {
            return 'location';
        }
        else {
            throw new Error('Incorrect URL');
        }
    },
    extract7z(downloadPath, extPath, _7zPath) {
        return 'extPath';
    },
    extractTar(downloadPath, extPath, _7zPath) {
        return 'extPath';
    },
    cacheDir(dir, tool, version) {
        return 'path to tool';
    },
    prependPath(toolPath) {
        return;
    }
});

const fsClone = fs;
fsClone.existsSync = function(pathToFile: string): boolean {
    if (pathToFile !== path.resolve(process.cwd(), '.npmrc')) {
        throw 'Incorrect path ' + pathToFile
    }
    return false;
};
fsClone.writeFileSync = function(path: string, data: any, options: fs.WriteFileOptions) {
    console.log('Writing file to path', path);
    console.log(data);
};
tmr.registerMock('fs', fsClone);

tmr.run();

function validateResource(resource: string) {
    let dataUrl = "https://nodejs.org/dist/index.json";
    if (resource != dataUrl) {
        throw new Error(`unexpected resource value ${resource}`);
    }
}

function validateOptions(options?: IRequestOptions) {

    if (!options) {
        return;
    }

    let errors: string[] = [];

    if (options.proxy.proxyUrl != proxyUrl) {
        errors.push(`unexpected proxyUrl value ${options.proxy.proxyUrl}`);
    }

    if (options.proxy.proxyUsername != proxyUsername) {
        errors.push(`unexpected proxyUsername value ${options.proxy.proxyUsername}`);
    }

    if (options.proxy.proxyUsername != proxyUsername) {
        errors.push(`unexpected proxyUsername value ${options.proxy.proxyUsername}`);
    }

    if (!errors || !errors.length) {
        if (errors.length > 0) {
            throw new Error(errors.join("\n"));
        }
    }
}
