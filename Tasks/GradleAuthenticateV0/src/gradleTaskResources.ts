// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as tl from 'azure-pipelines-task-lib/task';

const INIT_SCRIPT_IDENTITY = 'ARTIFACTS_GRADLE_AUTH_INIT_SCRIPT_IDENTITY';

function jobKey(): string {
    const id = tl.getVariable('System.JobId') || '';
    const attempt = tl.getVariable('System.JobAttempt') || '';
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
        || !/^[1-9][0-9]{0,9}$/.test(attempt)) {
        throw new Error(tl.loc('Error_InvalidJobIdentity'));
    }
    return `${id.toLowerCase()}-${attempt}`;
}

function assertCanonicalDirectory(directory: string): void {
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory()
        || path.relative(fs.realpathSync(directory), path.resolve(directory)) !== '') {
        throw new Error(tl.loc('Error_UnsafeJobPath'));
    }
}

function ensureCanonicalDirectory(directory: string): void {
    let existing = path.resolve(directory);
    while (!fs.lstatSync(existing, { throwIfNoEntry: false })) {
        const parent = path.dirname(existing);
        if (parent === existing) throw new Error(tl.loc('Error_UnsafeJobPath'));
        existing = parent;
    }
    assertCanonicalDirectory(existing);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    assertCanonicalDirectory(directory);
}

function assertRegularFile(file: string): boolean {
    const stat = fs.lstatSync(file, { throwIfNoEntry: false });
    if (!stat) {
        return false;
    }
    if (!stat.isFile() || stat.nlink !== 1
        || path.relative(fs.realpathSync(file), path.resolve(file)) !== '') {
        throw new Error(tl.loc('Error_UnsafeJobPath'));
    }
    return true;
}

function jobDirectory(): string {
    const key = jobKey();
    const root = tl.getVariable('Agent.TempDirectory');
    if (!root) throw new Error(tl.loc('Error_AgentTempUnavailable'));
    return path.resolve(root, `gradle-auth-${key}`);
}

function readRepository(directory: string): string {
    assertCanonicalDirectory(directory);
    const state = path.join(directory, 'repository.json');
    if (!assertRegularFile(state)) throw new Error(tl.loc('Error_UnownedJobResource'));
    const name: unknown = JSON.parse(fs.readFileSync(state, 'utf8'));
    if (typeof name !== 'string' || !/^repo-[a-zA-Z0-9]{6}$/.test(name)) {
        throw new Error(tl.loc('Error_UnownedJobResource'));
    }
    const repository = path.join(directory, name);
    assertCanonicalDirectory(repository);
    return repository;
}

export function getGradleUserHome(): string {
    return tl.getInput('gradleUserHome', false)
        || process.env['GRADLE_USER_HOME'] || path.join(os.homedir(), '.gradle');
}

function getInitScriptPath(gradleUserHome: string): string {
    return path.resolve(gradleUserHome, 'init.d', `azure-artifacts-init-${jobKey()}.gradle`);
}

export function prepareJobTempDirectory(): string {
    const directory = jobDirectory();
    ensureCanonicalDirectory(path.dirname(directory));
    try {
        fs.mkdirSync(directory, { mode: 0o700 });
    } catch (error: unknown) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
        return readRepository(directory);
    }
    assertCanonicalDirectory(directory);
    const repository = fs.mkdtempSync(path.join(directory, 'repo-'));
    assertCanonicalDirectory(repository);
    fs.writeFileSync(path.join(directory, 'repository.json'), JSON.stringify(path.basename(repository)),
        { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    return repository;
}

export function writeJobInitScript(gradleUserHome: string, content: string): void {
    const file = getInitScriptPath(gradleUserHome);
    const directory = path.dirname(file);
    const job = jobDirectory();
    readRepository(job);
    ensureCanonicalDirectory(directory);
    assertRegularFile(file);
    const temporaryFile = path.join(directory, `.azure-artifacts-init-${randomUUID()}.tmp`);
    fs.writeFileSync(temporaryFile, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    try {
        fs.renameSync(temporaryFile, file);
    } finally {
        if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
    }
    const stat = fs.lstatSync(file, { bigint: true });
    tl.setTaskVariable(INIT_SCRIPT_IDENTITY, JSON.stringify({
        device: stat.dev.toString(),
        inode: stat.ino.toString(),
    }));
}

export function deleteJobInitScript(): boolean {
    const file = getInitScriptPath(getGradleUserHome());
    const serialized = tl.getTaskVariable(INIT_SCRIPT_IDENTITY);
    if (!serialized) return false;
    const identity: unknown = JSON.parse(serialized);
    if (!identity || typeof identity !== 'object'
        || !('device' in identity) || typeof identity.device !== 'string'
        || !('inode' in identity) || typeof identity.inode !== 'string') {
        throw new Error(tl.loc('Error_UnownedJobResource'));
    }
    const directory = path.dirname(file);
    if (!fs.lstatSync(directory, { throwIfNoEntry: false })) return false;
    assertCanonicalDirectory(directory);
    if (!assertRegularFile(file)) return false;
    const stat = fs.lstatSync(file, { bigint: true });
    if (stat.dev.toString() !== identity.device || stat.ino.toString() !== identity.inode) {
        throw new Error(tl.loc('Error_UnownedJobResource'));
    }
    fs.unlinkSync(file);
    return true;
}
