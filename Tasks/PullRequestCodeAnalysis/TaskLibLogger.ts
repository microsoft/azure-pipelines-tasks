import tl = require('vsts-task-lib/task');

import { ILogger } from './PRCA/ILogger';

export class TaskLibLogger implements ILogger {

    LogWarning(message:string):void {
        tl.warning(message);
    }

    LogInfo(message:string):void {
        console.log(message);
    }

    LogDebug(message:string):void {
        tl.debug(message);
    }

}