import ma = require('./mock-answer');
import im = require('./internal');
import mocker = require('./lib-mocker');

export class TaskMockRunner {
    constructor(taskPath: string) {
        this._taskPath = taskPath;
    }

    _taskPath: string;
    _answers: ma.TaskLibAnswers | undefined;
    _exports: {[key: string]: any} = { };
    _moduleCount: number = 0;

    public setInput(name: string, val: string) {
        let key: string = im._getVariableKey(name);
        process.env['INPUT_' + key] = val;
    }

    public setVariableName(name: string, val: string, isSecret?: boolean) {
        let key: string = im._getVariableKey(name);
        if (isSecret) {
            process.env['SECRET_' + key] = val;
        }
        else {
            process.env['VSTS_TASKVARIABLE_' + key] = val;
        }
    }

    /**
     * Register answers for the mock "azure-pipelines-task-lib/task" instance.
     *
     * @param answers   Answers to be returned when the task lib functions are called.
     */
    public setAnswers(answers: ma.TaskLibAnswers) {
        this._answers = answers;
    }

    /**
    * Register a mock module. When require() is called for the module name,
    * the mock implementation will be returned instead.
    *
    * @param modName    Module name to override.
    * @param val        Mock implementation of the module.
    * @returns          void
    */
    public registerMock(modName: string, mod: any): void {
        this._moduleCount++;
        mocker.registerMock(modName, mod);
    }

    /**
    * Registers an override for a specific function on the mock "azure-pipelines-task-lib/task" instance.
    * This can be used in conjunction with setAnswers(), for cases where additional runtime
    * control is needed for a specific function.
    *
    * @param key    Function or field to override.
    * @param val    Function or field value.
    * @returns      void
    */
    public registerMockExport(key: string, val: any): void {
        this._exports[key] = val;
    }

    /**
    * Runs a task script.
    *
    * @param noMockTask     Indicates whether to mock "azure-pipelines-task-lib/task". Default is to mock.
    * @returns              void
    */
    public run(noMockTask?: boolean): void {
        // determine whether to enable mocker
        if (!noMockTask || this._moduleCount) {
            mocker.enable({warnOnUnregistered: false});
        }

        // answers and exports not compatible with "noMockTask" mode
        if (noMockTask) {
            if (this._answers || Object.keys(this._exports).length) {
                throw new Error('setAnswers() and registerMockExport() is not compatible with "noMockTask" mode');
            }
        }
        // register mock task lib
        else {
            var tlm = require('azure-pipelines-task-lib/mock-task');
            if (this._answers) {
                tlm.setAnswers(this._answers);
            }

            Object.keys(this._exports)
                .forEach((key: string): void => {
                    tlm[key] = this._exports[key];
                });

            mocker.registerMock('azure-pipelines-task-lib/task', tlm);
        }

        // run it
        require(this._taskPath);
    }
}
