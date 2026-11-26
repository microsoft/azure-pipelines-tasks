import * as fs from 'fs';
import * as path from 'path';
import * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import type { Platform } from 'azure-pipelines-task-lib/task';

const taskPath = path.join(__dirname, '..', 'filetransform.js');
const runner = new tmrm.TaskMockRunner(taskPath);
runner.setInput('folderPath', 'C:\\tempFolder');
runner.setInput('enableXmlTransform', 'true');
runner.setInput('xmlTransformationRules', '-transform web.Release.config -xml web.config');
runner.setInput('xmlTargetFiles', '');
runner.setInput('jsonTargetFiles', '');

const answers: ma.TaskLibAnswers = {
    which: {
        'ctt.exe': 'ctt.exe'
    },
    checkPath: {
        'ctt.exe': true
    },
    stats: {
        'C:\\tempFolder': {
            isDirectory: true
        }
    },
    osType: {
        osType: 'Windows'
    },
    getPlatform: {
        getPlatform: 0 as Platform
    },
    exist: {
        'C:\\tempFolder': true,
        'C:\\tempFolder\\web.Release.config': true,
        'c:\\tempfolder\\web.release.config': true
    },
    findMatch: {
        'web.config': ['C:\\tempFolder\\web.config']
    },
    exec: {
        'ctt.exe s:C:\\tempFolder\\web.config t:c:\\tempfolder\\web.release.config d:C:\\tempFolder\\web.config pw i verbose': {
            code: 0,
            stdout: 'ctt execution successful'
        },
        'ctt.exe s:C:\\tempFolder\\web.config t:C:\\tempFolder\\web.Release.config d:C:\\tempFolder\\web.config pw i verbose': {
            code: 0,
            stdout: 'ctt execution successful'
        }
    }
};

runner.registerMock('fs', {
    ...fs,
    readFileSync: function (filePath: string) {
        if (filePath.toLowerCase() === 'c:\\tempfolder\\web.release.config') {
            return Buffer.from('<configuration xmlns:xdt="http://schemas.microsoft.com/XML-Document-Transform"><appSettings xdt:Transform="SetAttributes" /></configuration>');
        }
        return fs.readFileSync(filePath);
    }
});

runner.registerMock('path', {
    ...path,
    join: function (...parts: string[]) {
        if (parts[parts.length - 1] === 'ctt.exe') {
            return 'ctt.exe';
        }
        return path.join(...parts);
    }
});

runner.setAnswers(answers);
runner.run();
