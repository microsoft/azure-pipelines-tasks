import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import taskLib = require('azure-pipelines-task-lib/task');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'usego.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

//Create assertAgent and getVariable mocks
const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.getInput = function (inputName: string, required?: boolean) {
    inputName = inputName.toLowerCase();
    if (inputName === 'version') {
        return '1.0.8';
    }
    if (process.env["__go_env__"]) {
        if(inputName == 'gopath') {
            return 'myGoPath';
        }
        if(inputName == 'gobin') {
            return 'myGoBin';
        }
    }
    return tl.getInput(inputName, required);
}
tlClone.getVariable = function(variable: string) {
    if (variable.toLowerCase() == 'agent.tempdirectory') {
        return 'temp';
    }
    if (variable.toLowerCase() == 'agent.toolsdirectory') {
        return 'tools';
    }
    return null;
};
tlClone.assertAgent = function(variable: string) {
    return;
};
tlClone.setSecret = function(password){
    console.log('Setting secret', password);
};
tlClone.setVariable = function(key, val) {
    console.log('Setting', key, 'to', val);
};
if (process.env["__proxy__"]) {
    tlClone.getHttpProxyConfiguration = function(requestUrl?: string): taskLib.ProxyConfiguration | null {
        return { proxyUrl: 'http://url.com', proxyUsername: 'username', proxyPassword: 'password', proxyBypassHosts: null};
    }
}
tmr.registerMock('azure-pipelines-task-lib/mock-task', tlClone);

//Create tool-lib mock
tmr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: function(toolName, versionSpec) {
        if (toolName != 'go' || versionSpec != '1.0.8') { 
            throw new Error('Searching for wrong tool');
        }
        if (process.env["__local_cache__"]) {
            console.log('Found tool locally');
            return 'cachedToolPath';
        }
        return '';
    },
    downloadTool: function(downloadUrl) {
        let correctUrl = '';
        if (process.env['__linux__']) {
            correctUrl = 'https://storage.googleapis.com/golang/go1.0.8.linux-amd64.tar.gz';
        }
        else {
            correctUrl = 'https://storage.googleapis.com/golang/go1.0.8.windows-386.zip';
        }
        if (correctUrl !== downloadUrl) {
            throw new Error('Trying to download with wrong url ' + downloadUrl);
        }
        console.log('Downloaded tool');
        return 'myToolPath'
    },
    extractZip: function(downloadPath) {
        if (downloadPath != 'myToolPath') {
            throw new Error('Incorrect download path');
        }
        console.log('Extracting zip');
        return downloadPath;
    },
    extractTar: function(downloadPath) {
        if (downloadPath != 'myToolPath') {
            throw new Error('Incorrect download path');
        }
        console.log('Extracting tar');
        return downloadPath;
    },
    cacheDir: function(toolRoot, toolName, version) {
        if (toolRoot !== path.join('myToolPath', 'go')) {
            throw new Error('Incorrect tool root');
        }
        if (toolName != 'go') {
            throw new Error('Incorrect tool name');            
        }
        if (version != '1.0.8') {
            throw new Error('Incorrect tool version');            
        }
        console.log('Caching tool');
        return 'cachedToolPath';
    },
    prependPath: function(myPath) {
        if (myPath !== path.join('cachedToolPath', 'bin')) {
            throw new Error('Incorrect cached tool path');
        }
        console.log('Prepending path');
    }
});

tmr.registerMock('os', {
    platform: function() {
        if (process.env['__linux__']) {
            return 'linux';
        }
        return 'win32';
    },
    arch: function() {
        if (process.env['__linux__']) {
            return 'x64';
        }
        return 'x32';
    }
});

// const fsClone = fs;
// fsClone.existsSync = function(pathToFile: string): boolean {
//     if (pathToFile !== path.resolve(process.cwd(), '.npmrc')) {
//         throw 'Incorrect path ' + pathToFile
//     }
//     return false;
// };
// fsClone.writeFileSync = function(path: string, data: any, options: fs.WriteFileOptions) {
//     console.log('Writing file to path', path);
//     console.log(data);
// };
// tmr.registerMock('fs', fsClone);

tmr.run();