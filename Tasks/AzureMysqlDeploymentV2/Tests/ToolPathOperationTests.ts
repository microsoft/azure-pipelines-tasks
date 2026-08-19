import tl = require('azure-pipelines-task-lib');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import ma = require('azure-pipelines-task-lib/mock-answer');
import * as path from 'path';
import { ToolPathOperations } from '../operations/ToolPathOperations';

export class ToolPathOperationTests  {

    public static startToolPathOperationL0Tests(){
        let tp = path.join(__dirname, 'ToolPathOperationsL0Tests.js');
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);
        // provide answers for task mock
        let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
            "which": {
                "mysql": "/bin/mysql"
            },
            "checkPath": {
                "/bin/mysql": true
            }
        };
        tr.setAnswers(a);
        tr.run();
    }

}

ToolPathOperationTests.startToolPathOperationL0Tests();
