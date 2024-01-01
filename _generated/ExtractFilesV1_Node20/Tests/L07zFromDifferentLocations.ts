import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import fs = require('fs');
import path = require('path');
import os = require('os');

enum Platform {
    Windows = 0,
    MacOS = 1,
    Linux = 2
}

let taskPath = path.join(__dirname, '..', 'extractfilestask.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = __dirname;

tmr.setInput('archiveFilePatterns', process.env['archiveFilePatterns']);
tmr.setInput('destinationFolder', __dirname);
tmr.setInput('cleanDestinationFolder', process.env['cleanDestinationFolder']);
tmr.setInput('overwriteExistingFiles', process.env['overwriteExistingFiles']);
tmr.setInput('pathToSevenZipTool', process.env['pathToSevenZipTool']);

let osType: Platform;
switch (os.type()) {
    case 'Linux':
        osType = Platform.Linux;
        break;
    case 'Darwin':
        osType = Platform.MacOS;
        break;
    case 'Windows_NT':
        osType = Platform.Windows;
        break;
    default:
        throw Error("Unknown OS type");
}
const isWindows: boolean = osType == Platform.Windows;

//Create osType, stats mocks, support not added in this version of task-lib
const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.getPlatform = function() {
    return osType;
};
tlClone.stats = function(path) {
    return fs.statSync(path);
};
tlClone.exist = function(path) {
    // Copied from task-lib
    var exist = false;
    try {
        exist = !!(path && fs.statSync(path) != null);
    } catch (err) {
        if (err && err.code === 'ENOENT') {
            exist = false;
        } else {
            throw err;
        }
    }
    return exist;
};
tlClone.rmRF = function(path) {
    console.log('Removing ' + path);
};
tmr.registerMock('azure-pipelines-task-lib/mock-task', tlClone);

let zipExecutable = path.join(__dirname, '..', '7zip', '7z.exe');
let sevenZip1Command: string = `${process.env['pathToSevenZipTool']} -aoa x -o${__dirname} ${path.join(__dirname, 'zip3.7z')}`;
let sevenZip2Command: string = `${zipExecutable} -aoa x -o${__dirname} ${path.join(__dirname, 'zip3.7z')}`;
if (!isWindows) {
    zipExecutable = 'path/to/7z'
    sevenZip1Command = `${process.env['pathToSevenZipTool']} -aoa x -o${__dirname} ${path.join(__dirname, 'zip3.7z')}`;
    sevenZip2Command = `${zipExecutable} -aoa x -o${__dirname} ${path.join(__dirname, 'zip3.7z')}`;
}

let a: ma.TaskLibAnswers;
if (isWindows) {
    a = <ma.TaskLibAnswers>{
        'exec': {}
    };   
} else {
    a = <ma.TaskLibAnswers>{
        'exec': {},
        'which': {
            '7z': 'path/to/7z'
        },
        'checkPath': {
            'path/to/7z': true
        }
    }; 
}

// Need to add these as seperate string since they are dynamic
a['exec'][sevenZip1Command] = {
    "code": 0,
    "stdout": "extracted zip3.7z"
}
a['exec'][sevenZip2Command] = {
    "code": 0,
    "stdout": "extracted zip3.7z"
}

tmr.setAnswers(a);

tmr.run();
