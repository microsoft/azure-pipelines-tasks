import * as taskLib from 'azure-pipelines-task-lib/task';
import { IExecOptions, ToolRunner } from 'azure-pipelines-task-lib/toolrunner';
import { Writable } from 'stream';
import { NOTATION, STATUS, WARNING } from './constants';

// notationRunner runs the notation command for each artifact.
export async function notationRunner(artifactRefs: string[], runCommand: (notation: ToolRunner, artifactRef: string, execOptions: IExecOptions) => Promise<number>): Promise<void> {
    // run notation command for each artifact
    let failedArtifactRefs = [];
    let succeededArtifactRefs = [];
    for (const artifactRef of artifactRefs) {
        let outStream = new WarningStream();
        const code = await runCommand(taskLib.tool(NOTATION), artifactRef, { outStream: outStream });
        if (code !== 0) {
            failedArtifactRefs.push(artifactRef);
            continue;
        }

        succeededArtifactRefs.push(artifactRef);
    }

    // output conclusion
    console.log(taskLib.loc('ResultSummary', artifactRefs.length, artifactRefs.length - failedArtifactRefs.length, failedArtifactRefs.length));
    if (succeededArtifactRefs.length > 0) {
        console.log(taskLib.loc('SucceededArtifacts', succeededArtifactRefs.join(', ')));
    }
    if (failedArtifactRefs.length > 0) {
        throw new Error(taskLib.loc('FailedArtifacts', failedArtifactRefs.join(', ')));
    }
}

// WarningStream is a writable stream that extracts warnings from logs.
class WarningStream extends Writable {
    private buffer: string;

    constructor() {
        super();
        this.buffer = '';
    }

    _write(chunk: Buffer, encoding: string, callback: () => void) {
        this.buffer += chunk.toString();
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || '';
        // extract warnings related to security from logs
        for (const line of lines) {
            if (line.startsWith('Warning: Always sign the artifact using the digest')) {
                taskLib.warning(line);
                taskLib.setTaskVariable(STATUS, WARNING);
            } else {
                console.log(line);
            }
        }
        callback();
    }
}
