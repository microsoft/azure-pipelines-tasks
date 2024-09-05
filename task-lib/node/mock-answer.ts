import * as task from './task';

export interface TaskLibAnswerExecResult {
    code: number,
    stdout?: string,
    stderr?: string
}

export interface TaskLibAnswers {
    checkPath?: { [key: string]: boolean },
    cwd?: { [key: string]: string },
    exec?: { [ key: string]: TaskLibAnswerExecResult },
    exist?: { [key: string]: boolean },
    find?: { [key: string]: string[] },
    findMatch?: { [key: string]: string[] },
    getPlatform?: { [key: string]: task.Platform },
    getNodeMajorVersion?: { [key: string]: Number },
    getAgentMode?: { [key: string]: task.AgentHostedMode },
    legacyFindFiles?: { [key: string]: string[] },
    ls?: { [key: string]: string },
    osType?: { [key: string]: string },
    rmRF?: { [key: string]: { success: boolean } },
    stats?: { [key: string]: any }, // Can't use `fs.Stats` as most existing uses don't mock all required properties
    which?: { [key: string]: string },
}

export type MockedCommand = keyof TaskLibAnswers;

export class MockAnswers {
    private _answers: TaskLibAnswers | undefined;

    public initialize(answers: TaskLibAnswers) {
        if (!answers) {
            throw new Error('Answers not supplied');
        }
        this._answers = answers;
    }

    public getResponse(cmd: MockedCommand, key: string, debug: (message: string) => void): any {
        debug(`looking up mock answers for ${JSON.stringify(cmd)}, key '${JSON.stringify(key)}'`);
        if (!this._answers) {
            throw new Error('Must initialize');
        }

        if (!this._answers[cmd]) {
            debug(`no mock responses registered for ${JSON.stringify(cmd)}`);
            return null;
        }

        const cmd_answer = this._answers[cmd]!;

        //use this construction to avoid falsy zero
        if (cmd_answer[key] != null) {
            debug('found mock response');
            return cmd_answer[key];
        }

        if (key && process.env['MOCK_NORMALIZE_SLASHES'] === 'true') {
            // try normalizing the slashes
            var key2 = key.replace(/\\/g, "/");
            if (cmd_answer[key2]) {
                debug('found mock response for normalized key');
                return cmd_answer[key2];
            }
        }

        debug('mock response not found');
        return null;
    }
}
