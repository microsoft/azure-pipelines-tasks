import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import fs = require('fs');
import os = require('os');
import path = require('path');

const testCase: { releaseType: string; cached: boolean; platform: string } = JSON.parse(process.env['DOCKER_INSTALLER_TEST_CASE']);
const tr = new tmrm.TaskMockRunner(path.join(__dirname, '..', 'src', 'dockertoolinstaller.js'));
tr.setInput('dockerVersion', '28.5.2');
tr.setInput('releaseType', testCase.releaseType);

const dockerExecutable = testCase.platform === 'Windows_NT' ? 'docker.exe' : 'docker';
const cachedToolPath = path.join(__dirname, 'tool-cache');
const dockerPath = path.join(cachedToolPath, dockerExecutable);
const answers: ma.TaskLibAnswers = {
    which: {
        docker: dockerPath
    },
    checkPath: {
        [dockerPath]: true
    },
    exec: {
        [`${dockerPath} --version`]: {
            code: 0,
            stdout: 'Docker version 28.5.2, build mock'
        }
    },
    find: {
        [cachedToolPath]: [dockerPath]
    }
};
tr.setAnswers(answers);

tr.registerMock('os', {
    ...os,
    type: function() {
        return testCase.platform;
    }
});

tr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: function(toolName: string, version: string) {
        console.log(`findLocalTool: ${toolName}, ${version}`);
        return testCase.cached ? cachedToolPath : '';
    },
    downloadTool: async function(url: string) {
        console.log(`downloadTool: ${url}`);
        return path.join(__dirname, 'docker-archive');
    },
    extractTar: async function() {
        return path.join(__dirname, 'extracted');
    },
    extractZip: async function() {
        return path.join(__dirname, 'extracted');
    },
    cacheFile: async function(sourceFile: string, destFileName: string, tool: string, version: string) {
        console.log(`cacheFile: ${tool}, ${version}`);
        return cachedToolPath;
    },
    prependPath: function(toolPath: string) {
        console.log(`prependPath: ${toolPath}`);
    }
});

tr.registerMock('fs', {
    ...fs,
    chmodSync: function(filePath: string, mode: string) {
        console.log(`chmodSync: ${filePath}`);
    }
});

tr.run();
