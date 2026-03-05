import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as path from 'path';
import { TestEnvVars } from './TestConstants';

// Suppress debug noise from make.js setting SYSTEM_DEBUG=true
delete process.env['SYSTEM_DEBUG'];

const taskPath = path.join(__dirname, '..', 'npmauthcleanup.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// ── Inputs ────────────────────────────────────────────────────────────────────

const npmrcPath = process.env[TestEnvVars.cleanupNpmrcPath] || '';
if (npmrcPath) {
    tr.setInput('workingFile', npmrcPath);
}

// ── Variables ─────────────────────────────────────────────────────────────────

const saveNpmrcPath = process.env[TestEnvVars.cleanupSaveNpmrcPath] || '';
if (saveNpmrcPath) {
    process.env['SAVE_NPMRC_PATH'] = saveNpmrcPath;
}

const tempDirectory = process.env[TestEnvVars.cleanupTempDirectory] || '';
if (tempDirectory) {
    process.env['NPM_AUTHENTICATE_TEMP_DIRECTORY'] = tempDirectory;
}

// ── tl.exist answers ──────────────────────────────────────────────────────────

const indexFilePath = saveNpmrcPath ? path.join(saveNpmrcPath, 'index.json') : '';

const indexShouldExist = process.env[TestEnvVars.cleanupIndexShouldExist] !== 'false';
const npmrcShouldExist = process.env[TestEnvVars.cleanupNpmrcShouldExist] !== 'false';
const tempDirExists   = process.env[TestEnvVars.cleanupTempDirExists] === 'true';

const existAnswers: { [key: string]: boolean } = {};
if (indexFilePath) { existAnswers[indexFilePath] = indexShouldExist; }
if (npmrcPath)     { existAnswers[npmrcPath]     = npmrcShouldExist; }
if (tempDirectory) { existAnswers[tempDirectory] = tempDirExists;    }

const rmRFAnswers: { [key: string]: { success: boolean } } = {};
if (tempDirectory) { rmRFAnswers[tempDirectory] = { success: true }; }

const answers: ma.TaskLibAnswers = {
    which:     {},
    checkPath: {},
    exist:     existAnswers,
    rmRF:      rmRFAnswers,
    stats:     {}
};

tr.setAnswers(answers);

// ── Run ───────────────────────────────────────────────────────────────────────

if (require.main === module) {
    tr.run();
}
