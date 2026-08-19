// @ts-check
'use strict';

/**
 * Unit tests for labelIssues.cjs decision logic. Run with:
 *   node --test .github/workflows/labelIssues.test.cjs
 *
 * These cover the folder-driven `Task:` label resolution (buildTaskIndex /
 * resolveTaskName) and its integration into computeLabels. No network or
 * js-yaml dependency: rules are passed inline and the task folder list is a
 * small fixture that mirrors real Tasks/ folders.
 */

const test = require('node:test');
const assert = require('node:assert');

const {
    computeLabels,
    resolveTaskName,
    buildTaskIndex,
    normalizeTaskKey,
    canonicalTaskName
} = require('./labelIssues.cjs');

// A fixture mirroring a slice of the real Tasks/ folders, including versioned
// folders and the ambiguous prefixes that used to break hardcoded labels.
const TASK_FOLDERS = [
    'AzureCLIV1',
    'AzureCLIV2',
    'AzureAppServiceManageV0',
    'AzureAppServiceSettingsV1',
    'IISWebAppDeployment',
    'IISWebAppDeploymentOnMachineGroupV0',
    'IISWebAppManagementOnMachineGroupV0',
    'BashV3',
    'DotNetCoreCLIV2',
    'Common'
];

const INDEX = buildTaskIndex(TASK_FOLDERS);

function issueBody(taskName) {
    return `### Task name\n\n${taskName}\n\n### What happened\n\nsomething`;
}

test('normalizeTaskKey strips version, punctuation and @version', () => {
    assert.strictEqual(normalizeTaskKey('AzureCLIV2'), 'azurecli');
    assert.strictEqual(normalizeTaskKey('AzureCLI@2'), 'azurecli');
    assert.strictEqual(normalizeTaskKey('Azure CLI'), 'azurecli');
});

test('canonicalTaskName drops trailing version segment', () => {
    assert.strictEqual(canonicalTaskName('AzureCLIV2'), 'AzureCLI');
    assert.strictEqual(canonicalTaskName('IISWebAppDeployment'), 'IISWebAppDeployment');
});

test('buildTaskIndex ignores Common and is 1:1 for the fixture', () => {
    assert.ok(!INDEX.has('common'));
    assert.deepStrictEqual([...INDEX.get('azurecli')], ['AzureCLI']);
});

test('resolveTaskName: version-agnostic exact match', () => {
    assert.strictEqual(resolveTaskName('AzureCLI@2', INDEX), 'AzureCLI');
    assert.strictEqual(resolveTaskName('AzureCLIV1', INDEX), 'AzureCLI');
    assert.strictEqual(resolveTaskName('bash', INDEX), 'Bash');
});

test('resolveTaskName: distinct labels for AppService Manage vs Settings', () => {
    assert.strictEqual(resolveTaskName('AzureAppServiceManage', INDEX), 'AzureAppServiceManage');
    assert.strictEqual(resolveTaskName('AzureAppServiceSettings', INDEX), 'AzureAppServiceSettings');
});

test('resolveTaskName: ambiguous prefixes resolve to nothing (no guessing)', () => {
    // "AzureAppService" and "IISWeb" each prefix-match several folders.
    assert.strictEqual(resolveTaskName('AzureAppService', INDEX), '');
    assert.strictEqual(resolveTaskName('IISWeb', INDEX), '');
    // A vague single word matches many folders -> nothing.
    assert.strictEqual(resolveTaskName('Azure', INDEX), '');
});

test('resolveTaskName: specific IIS names resolve exactly', () => {
    assert.strictEqual(resolveTaskName('IISWebAppDeployment', INDEX), 'IISWebAppDeployment');
    assert.strictEqual(
        resolveTaskName('IISWebAppManagementOnMachineGroup', INDEX),
        'IISWebAppManagementOnMachineGroup'
    );
});

test('resolveTaskName: removed/unknown task resolves to nothing', () => {
    assert.strictEqual(resolveTaskName('AzureMonitorAlerts', INDEX), '');
    assert.strictEqual(resolveTaskName('TotallyNotATask', INDEX), '');
});

test('computeLabels adds the resolved Task: label alongside rule Area labels', () => {
    const rules = [{ valueFor: '**Enter Task Name**', contains: 'AzureCLI', addLabels: ['Area: Release'] }];
    const { labels } = computeLabels({
        title: 'x',
        body: issueBody('AzureCLI@2'),
        existingLabels: [],
        rules,
        nomatches: [],
        tags: [],
        taskFolders: TASK_FOLDERS
    });
    assert.ok(labels.has('Area: Release'));
    assert.ok(labels.has('Task: AzureCLI'));
});

test('computeLabels adds no Task: label for a removed task, keeps Area', () => {
    const rules = [{ valueFor: '**Enter Task Name**', contains: 'MonitorAlerts', addLabels: ['Area: Release'] }];
    const { labels } = computeLabels({
        title: 'x',
        body: issueBody('AzureMonitorAlerts'),
        existingLabels: [],
        rules,
        nomatches: [],
        tags: [],
        taskFolders: TASK_FOLDERS
    });
    assert.ok(labels.has('Area: Release'));
    assert.ok(![...labels].some(l => /^Task:/.test(l)));
});

test('computeLabels never re-adds a Task: label the issue already has', () => {
    const { labels } = computeLabels({
        title: 'x',
        body: issueBody('AzureCLIV2'),
        existingLabels: ['Task: AzureCLI'],
        rules: [],
        nomatches: [],
        tags: [],
        taskFolders: TASK_FOLDERS
    });
    assert.ok(!labels.has('Task: AzureCLI'));
});
