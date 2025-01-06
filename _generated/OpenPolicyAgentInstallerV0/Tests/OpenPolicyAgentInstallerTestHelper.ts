import { TaskMockRunner } from "azure-pipelines-task-lib/mock-run";
import fs = require('fs');
import Q = require('q');

interface IMockToolLibOptions {
    findLocalToolFuncReturnValue?: string,
    cleanVersionFuncReturnValue?: string,
    throwInPromise?: boolean
};

export function registerMockedTaskLib(tr: TaskMockRunner): void {
    const taskLib = require('azure-pipelines-task-lib/mock-task');
    const taskLibMock = Object.assign({}, taskLib);
    taskLibMock.getVariable = (variable: string) => {
        if (variable.toLowerCase() === 'agent.tempdirectory' || variable.toLowerCase() === 'agent.toolsdirectory') {
            return 'temp';
        }
        return null;
    };

    taskLibMock.cp = (v1, v2, v3): void => {}
    taskLibMock.which = (v1, v2): string => '';
    tr.registerMock('azure-pipelines-task-lib/mock-task', taskLibMock);
};

export function registerMockedToolRunner(tr: TaskMockRunner): void {
    const MockToolRunner = function (tool) {
        let _tool;
        let _line;
        let _args;
        
        this.init = (tool) => this._tool = tool;
    
        this.arg = (args) => {
            this._args = args;
            return this;
        };
    
        this.line = (val) => {
            this._line = val;
            return this;
        };
    
        this.exec = (options) => {
            const defer = Q.defer();
            setTimeout(function() {
                defer.resolve(0);
            }, 100);
            return defer.promise;
        };
    
        this.init(tool);
    };
    tr.registerMockExport('tool', (tool) => {
        return new MockToolRunner(tool);
    });
};

export function registerMockedFsLib(tr: TaskMockRunner): void {
    const fsAnswers = {
        readFileSync: (v1, v2): string => {
            return '{}'
        },
        existsSync: (v1): boolean => true,
        chmodSync: (v1, v2): void => {}
      };
    tr.registerMock('fs', {...fs, ...fsAnswers});
};

export function registerMockedToolLib(tr: TaskMockRunner, options: IMockToolLibOptions = {}): void {
    const {
        findLocalToolFuncReturnValue = 'some path',
        throwInPromise = false,
        cleanVersionFuncReturnValue = ''
    } = options;
    
    tr.registerMock('azure-pipelines-tool-lib/tool', {
        findLocalTool: (v1): string => findLocalToolFuncReturnValue,
        downloadTool: (v1): Promise<string> => new Promise((resolve) => {
            if (throwInPromise)
                throw new Error('error in promise');
            resolve('');
        }),
        prependPath: (v1): void => {},
        cacheFile: (v1, v2, v3, v4): void => {},
        cleanVersion: (v1): string => cleanVersionFuncReturnValue
    });
};