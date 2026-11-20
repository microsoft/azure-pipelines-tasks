import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as path from 'path';
import { TestEnvVars } from './TestConstants';

delete process.env['SYSTEM_DEBUG'];

const taskPath = path.join(__dirname, '..', 'npmauthcleanup.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const npmrcPath = process.env[TestEnvVars.cleanupNpmrcPath] || '';
if (npmrcPath) {
    tr.setInput('workingFile', npmrcPath);
}

const saveNpmrcPath = process.env[TestEnvVars.cleanupSaveNpmrcPath] || '';
if (saveNpmrcPath) {
    process.env['SAVE_NPMRC_PATH'] = saveNpmrcPath;
}
const tempDirectory = process.env[TestEnvVars.cleanupTempDirectory] || '';
if (tempDirectory) {
    process.env['NPM_AUTHENTICATE_TEMP_DIRECTORY'] = tempDirectory;
}
const taskTempDirectory = process.env[TestEnvVars.cleanupTaskTempDirectory] || '';
if (taskTempDirectory) {
    process.env['VSTS_TASKVARIABLE_NPM_AUTHENTICATE_BACKUP_ROOT'] = taskTempDirectory;
}
const agentHomeDirectory = process.env[TestEnvVars.cleanupAgentHomeDirectory] || '';
if (agentHomeDirectory) {
    process.env['AGENT_HOMEDIRECTORY'] = agentHomeDirectory;
}
const agentTempDirectory = process.env[TestEnvVars.cleanupAgentTempDirectory] || '';
if (agentTempDirectory) {
    process.env['AGENT_TEMPDIRECTORY'] = agentTempDirectory;
}

const indexFilePath = saveNpmrcPath ? path.join(saveNpmrcPath, 'index.json') : '';
const indexShouldExist = process.env[TestEnvVars.cleanupIndexShouldExist] !== 'false';
const npmrcShouldExist = process.env[TestEnvVars.cleanupNpmrcShouldExist] !== 'false';

const existAnswers: { [key: string]: boolean } = {};
if (indexFilePath) { existAnswers[indexFilePath] = indexShouldExist; }
if (npmrcPath)     { existAnswers[npmrcPath]     = npmrcShouldExist; }

const rmRFAnswers: { [key: string]: { success: boolean } } = {};
if (taskTempDirectory) {
    rmRFAnswers[taskTempDirectory] = { success: true };
    rmRFAnswers[path.resolve(taskTempDirectory)] = { success: true };
}

const answers: ma.TaskLibAnswers = {
    which: {},
    checkPath: {},
    exist: existAnswers,
    rmRF: rmRFAnswers,
    stats: {}
};
tr.setAnswers(answers);

if (require.main === module) {
    tr.run();
}
