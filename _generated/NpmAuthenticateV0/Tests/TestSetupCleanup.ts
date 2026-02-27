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

// Compute the index.json path that npmauthcleanup.ts derives from SAVE_NPMRC_PATH
const indexFilePath = saveNpmrcPath ? path.join(saveNpmrcPath, 'index.json') : '';

// Defaults: both the index file and the .npmrc file exist unless overridden
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

// ── Mock: packaging util ──────────────────────────────────────────────────────

tr.registerMock('azure-pipelines-tasks-packaging-common/util', {
    restoreFileWithName: function (filePath: string, _fileContent: string, _backupDir: string) {
        // Log so L0.Cleanup.ts tests can assert restoreFileWithName was reached
        console.log(`RESTORE_FILE_CALLED:${filePath}`);
    },
    saveFileWithName: function () {},
    logError:   function (e: any)    { console.error(String(e)); },
    toNerfDart: function (url: string) { return url.replace(/^https?:/, ''); }
});

// ── Run ───────────────────────────────────────────────────────────────────────

if (require.main === module) {
    tr.run();
}
