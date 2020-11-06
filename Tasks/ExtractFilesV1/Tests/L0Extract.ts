import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import fs = require('fs');
import path = require('path');
import os = require('os');

let taskPath = path.join(__dirname, '..', 'extractfilestask.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = __dirname;

tmr.setInput('archiveFilePatterns', process.env['archiveFilePatterns']);
tmr.setInput('destinationFolder', __dirname);
tmr.setInput('cleanDestinationFolder', process.env['cleanDestinationFolder']);
tmr.setInput('overwriteExistingFiles', process.env['overwriteExistingFiles']);
const osType = os.type();
const isWindows = !!osType.match(/^Win/);

//Create osType, stats mocks, support not added in this version of task-lib
const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.osType = function() {
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
let sevenZip1Command: string = `${zipExecutable} -aoa x -o${__dirname} ${path.join(__dirname, 'zip1.zip')}`;
let sevenZip2Command: string = `${zipExecutable} -aoa x -o${__dirname} ${path.join(__dirname, 'zip2.zip')}`;
let tarCommand = `${zipExecutable} -aoa x -o${__dirname} ${path.join(__dirname, 'tar.tar')}`;
if (!isWindows) {
    zipExecutable = 'path/to/unzip'
    sevenZip1Command = `${zipExecutable} -o ${path.join(__dirname, 'zip1.zip')} -d ${__dirname}`;
    sevenZip2Command = `${zipExecutable} -o ${path.join(__dirname, 'zip2.zip')} -d ${__dirname}`;
    tarCommand = `path/to/tar -xvf ${path.join(__dirname, 'tar.tar')} -C ${__dirname}`;
}

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'exec': {},
    'which': {
        'unzip': 'path/to/unzip',
        'tar': 'path/to/tar'
    },
    'checkPath': {
        'path/to/unzip': true,
        'path/to/tar': true
    }
};

// Need to add these as seperate string since they are dynamic
a['exec'][sevenZip1Command] = {
    "code": 0,
    "stdout": "extracted zip1"
}
a['exec'][sevenZip2Command] = {
    "code": 0,
    "stdout": "extracted zip2"
}
a['exec'][tarCommand] = {
    "code": 0,
    "stdout": "extracted tar"
}

tmr.setAnswers(a);

tmr.run();