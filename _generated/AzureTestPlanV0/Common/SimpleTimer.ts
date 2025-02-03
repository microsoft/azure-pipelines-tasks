import { ciDictionary } from "./ciEventLogger";
import * as tl from 'azure-pipelines-task-lib/task';
let perf = require('performance-now');

export class SimpleTimer {
    private startTime: number;
    private endTime: number;
    private featureName: string;

    constructor(featureName: string) {
        this.startTime = 0;
        this.endTime = 0;
        this.featureName = featureName;
    }

    start() {
        this.startTime = perf();
    }

    stop(ciData:ciDictionary) {
        this.endTime = perf();
        tl.debug(`Execution Time for ${this.featureName} was ${this.getElapsedTime()} in milli-seconds`);
        ciData[`Execution Time for ${this.featureName} in milli-seconds`] = this.getElapsedTime();
    }

    getElapsedTime(): number {
        if (this.startTime === 0 || this.endTime === 0) {
            throw new Error("Timer has not been started or stopped.");
        }
        return this.endTime - this.startTime;
    }
}
