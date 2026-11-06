import * as path from 'path';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as mt from 'azure-pipelines-task-lib/mock-task';
import * as tl from 'azure-pipelines-task-lib/task';
import { TestEnvVars } from './TestConstants';

const root = process.env[TestEnvVars.globalTestRoot];
const tr = new tmrm.TaskMockRunner(path.join(__dirname, 'GlobalConfigScenario.js'));
process.env.AGENT_TEMPDIRECTORY = root;
delete process.env.NPM_CONFIG_GLOBALCONFIG;
delete process.env.npm_config_globalconfig;
delete process.env.NPM_AUTHENTICATE_GLOBAL_CONFIG;
delete process.env.NPM_AUTHENTICATE_GLOBAL_CONFIG_STATE;

tr.registerMock('azure-pipelines-task-lib/task', {
    ...mt,
    loc: tl.loc,
    setResourcePath: tl.setResourcePath,
    which: (tool: string) => tool,
    execSync: (tool: string, args: string[], options: { silent?: boolean }) => {
        if (!options.silent) {
            throw new Error('Global configuration tools must run silently');
        }
        if (tool === 'npm') {
            return {
                code: process.env[TestEnvVars.globalResolutionFailure] ? 1 : 0,
                stdout: process.env.NPM_CONFIG_GLOBALCONFIG || path.join(root, 'original.npmrc'),
                stderr: 'sensitive diagnostic that must not be logged',
                error: undefined
            };
        }
        if (tool === 'whoami') {
            return {
                code: process.env[TestEnvVars.globalScenario] === 'permissions' ? 1 : 0,
                stdout: '"test","S-1-5-21-123"', stderr: '', error: undefined
            };
        }
        if (tool === 'icacls' && args.includes('/inheritance:r')) {
            return { code: 0, stdout: '', stderr: '', error: undefined };
        }
        throw new Error('Unexpected tool invocation');
    }
});
tr.run(true);
