import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as ini from 'ini';
import * as tl from 'azure-pipelines-task-lib/task';
import { NpmrcCredential } from './npmrcCredential';
import { mergeNpmrcCredential } from './npmauthutils';

const managedPathVariable = 'NPM_AUTHENTICATE_GLOBAL_CONFIG';
const managedStateVariable = 'NPM_AUTHENTICATE_GLOBAL_CONFIG_STATE';
const stateVariable = 'NPM_AUTHENTICATE_GLOBAL_STATE';
const selectionVariable = 'NPM_CONFIG_GLOBALCONFIG';

interface FileSystemObjectIdentifiers {
    deviceId: string;
    inodeNumber: string;
}

interface GlobalConfigState {
    generatedGlobalConfigPath: string;
    directoryIdentifiers: FileSystemObjectIdentifiers;
    configFileIdentifiers: FileSystemObjectIdentifiers;
    originalGlobalConfigOverride: string | null;
}

// Capture filesystem identifiers in a JSON-serializable form.
function getFileSystemObjectIdentifiers(stats: fs.BigIntStats): FileSystemObjectIdentifiers {
    return { deviceId: stats.dev.toString(), inodeNumber: stats.ino.toString() };
}

// Check whether filesystem metadata matches the recorded object identifiers.
function matchesFileSystemObjectIdentifiers(stats: fs.BigIntStats, expected: FileSystemObjectIdentifiers): boolean {
    return stats.dev.toString() === expected.deviceId && stats.ino.toString() === expected.inodeNumber;
}

// Check that an entry is a regular file with the expected filesystem identifiers.
function isExpectedConfigFile(stats: fs.BigIntStats, expectedIdentifiers: FileSystemObjectIdentifiers): boolean {
    return stats.isFile() && matchesFileSystemObjectIdentifiers(stats, expectedIdentifiers);
}

// Validate the runtime structure of deserialized filesystem identifiers.
function isValidFileSystemObjectIdentifiers(value: unknown): value is FileSystemObjectIdentifiers {
    return typeof value === 'object' && value !== null
        && 'deviceId' in value && typeof value.deviceId === 'string'
        && 'inodeNumber' in value && typeof value.inodeNumber === 'string';
}

// Validate the runtime structure of saved global-config coordination state.
function isValidGlobalConfigState(value: unknown): value is GlobalConfigState {
    return typeof value === 'object' && value !== null
        && 'generatedGlobalConfigPath' in value && typeof value.generatedGlobalConfigPath === 'string'
        && 'directoryIdentifiers' in value && isValidFileSystemObjectIdentifiers(value.directoryIdentifiers)
        && 'configFileIdentifiers' in value && isValidFileSystemObjectIdentifiers(value.configFileIdentifiers)
        && 'originalGlobalConfigOverride' in value
        && (value.originalGlobalConfigOverride === null || typeof value.originalGlobalConfigOverride === 'string');
}

// Parse saved coordination state and reject malformed JSON or invalid fields.
function parseState(serialized: string): GlobalConfigState {
    let value: unknown;
    try {
        value = JSON.parse(serialized);
    } catch {
        throw new Error(tl.loc('Error_GlobalConfigStateInvalid'));
    }
    if (!isValidGlobalConfigState(value)) {
        throw new Error(tl.loc('Error_GlobalConfigStateInvalid'));
    }
    return value;
}

// Detect dangling links for ownership checks and propagate errors other than a missing entry.
function pathEntryExists(fileSystemPath: string): boolean {
    try {
        fs.lstatSync(fileSystemPath);
        return true;
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}

// Verify that the generated config directory remains in its expected location and has not been replaced.
function verifyTaskOwnedConfigDirectory(state: GlobalConfigState): void {
    const generatedGlobalConfigDirectory = path.dirname(state.generatedGlobalConfigPath);
    const agentTempDirectory = tl.getVariable('Agent.TempDirectory');
    if (!agentTempDirectory || path.dirname(generatedGlobalConfigDirectory) !== fs.realpathSync(agentTempDirectory)
        || !path.basename(generatedGlobalConfigDirectory).startsWith('npmAuthenticate-global-')
        || path.basename(state.generatedGlobalConfigPath) !== '.npmrc') {
        throw new Error(tl.loc('Error_GlobalConfigDirectoryLocation'));
    }
    const stats = fs.lstatSync(generatedGlobalConfigDirectory, { bigint: true });
    if (!stats.isDirectory() || !matchesFileSystemObjectIdentifiers(stats, state.directoryIdentifiers)) {
        throw new Error(tl.loc('Error_GlobalConfigDirectoryChanged'));
    }
}

// Open the generated config for updates, checking filesystem identifiers before and after opening.
function openVerifiedTaskGeneratedGlobalConfig(state: GlobalConfigState): number {
    verifyTaskOwnedConfigDirectory(state);
    const stats = fs.lstatSync(state.generatedGlobalConfigPath, { bigint: true });
    if (!isExpectedConfigFile(stats, state.configFileIdentifiers)) {
        throw new Error(tl.loc('Error_GlobalConfigFileChanged'));
    }
    const configFileDescriptor = fs.openSync(state.generatedGlobalConfigPath, 'r+');
    try {
        const opened = fs.fstatSync(configFileDescriptor, { bigint: true });
        if (!isExpectedConfigFile(opened, state.configFileIdentifiers)) {
            throw new Error(tl.loc('Error_GlobalConfigFileChanged'));
        }
        return configFileDescriptor;
    } catch (error) {
        fs.closeSync(configFileDescriptor);
        throw error;
    }
}

// Ask npm for its effective global-config path so existing settings can be preserved.
export function resolveGlobalConfigPath(): string {
    const result = tl.execSync(tl.which('npm', true), ['config', 'get', 'globalconfig'], { silent: true });
    const selected = result.stdout && result.stdout.trim();
    if (result.error || result.code !== 0 || !selected || !path.isAbsolute(selected)
        || /[\r\n]/.test(selected)) {
        // npm diagnostics can include configuration values; do not forward them.
        throw new Error(tl.loc('Error_GlobalConfigResolution'));
    }
    return path.resolve(selected);
}

// Replace matching authentication, preserve unrelated settings, and omit full-line comments.
export function mergeGlobalCredentials(contents: string, entries: NpmrcCredential[]): string {
    if (contents.split(/\r?\n/).some(line => /^\s*\[/.test(line))) {
        throw new Error(tl.loc('Error_GlobalConfigSections'));
    }
    let lines = contents.split(/\r?\n/).filter(line => !/^\s*[#;]/.test(line));
    for (const entry of entries) {
        lines = mergeNpmrcCredential(lines, entry, {
            removeExisting: 'credentialsForExactRegistry',
            removeComments: true
        }).lines;
    }
    return lines.join(os.EOL) + os.EOL;
}

// Read existing global settings and reject unsupported path values before copying them.
function readOriginalConfig(globalConfigPath: string): string {
    if (!pathEntryExists(globalConfigPath)) {
        tl.debug(tl.loc('Info_GlobalConfigMissing'));
        return '';
    }
    const stats = fs.statSync(globalConfigPath);
    if (!stats.isFile()) {
        throw new Error(tl.loc('Error_GlobalConfigSource'));
    }
    const contents = fs.readFileSync(globalConfigPath, 'utf8');
    const config = ini.parse(contents);
    // Reject path settings whose relocation semantics have not been established.
    for (const key of Object.keys(config)) {
        if (['cafile', 'certfile', 'keyfile', 'cache', 'prefix', 'userconfig',
            'globalconfig', 'logs-dir', 'init-module'].includes(key)
            || /:(cafile|certfile|keyfile)$/.test(key)) {
            const value = config[key];
            if (typeof value !== 'string') {
                throw new Error(tl.loc('Error_GlobalConfigRelativePath'));
            }
            const expanded = value.replace(/\$\{([^}]+)\}/g,
                (_match: string, name: string) => process.env[name] ?? '${' + name + '}');
            if (expanded && !path.isAbsolute(expanded) && !/^~[\\/]/.test(expanded)) {
                throw new Error(tl.loc('Error_GlobalConfigRelativePath'));
            }
        }
    }
    return contents;
}

// Write all config bytes and truncate any remaining previous contents.
function writeContents(configFileDescriptor: number, contents: string): void {
    const buffer = Buffer.from(contents, 'utf8');
    let offset = 0;
    while (offset < buffer.length) {
        const written = fs.writeSync(configFileDescriptor, buffer, offset, buffer.length - offset, offset);
        if (!written) {
            throw new Error(tl.loc('Error_GlobalConfigWrite'));
        }
        offset += written;
    }
    fs.ftruncateSync(configFileDescriptor, buffer.length);
}

// Restrict access to the generated config directory using platform-specific permissions.
function restrictDirectory(directory: string): void {
    if (process.platform !== 'win32') {
        fs.chmodSync(directory, 0o700);
        return;
    }
    const user = tl.execSync(tl.which('whoami', true), ['/user', '/fo', 'csv', '/nh'], { silent: true });
    const sid = user.stdout && user.stdout.match(/S-1-\d+(?:-\d+)+/);
    if (user.error || user.code !== 0 || !sid) {
        throw new Error(tl.loc('Error_GlobalConfigPermissions'));
    }
    const acl = tl.execSync(tl.which('icacls', true),
        [directory, '/grant:r', `*${sid[0]}:(OI)(CI)F`, '/inheritance:r'], { silent: true });
    if (acl.error || acl.code !== 0) {
        throw new Error(tl.loc('Error_GlobalConfigPermissions'));
    }
}

// Create or update the task-generated global config and select it for subsequent job steps.
export function saveAndActivateGlobalConfig(entries: NpmrcCredential[]): void {
    const selected = resolveGlobalConfigPath();
    const managed = tl.getVariable(managedPathVariable);
    let state: GlobalConfigState;
    let contents: string;
    if (managed) {
        if (path.resolve(managed) !== selected) {
            throw new Error(tl.loc('Error_GlobalConfigSelectionChanged'));
        }
        const serialized = tl.getVariable(managedStateVariable);
        if (!serialized) {
            throw new Error(tl.loc('Error_GlobalConfigStateInvalid'));
        }
        state = parseState(serialized);
        if (state.generatedGlobalConfigPath !== managed) {
            throw new Error(tl.loc('Error_GlobalConfigStateInvalid'));
        }
        // Each invocation retains filesystem identifiers for its own post-job cleanup.
        const configFileDescriptor = openVerifiedTaskGeneratedGlobalConfig(state);
        try {
            contents = fs.readFileSync(configFileDescriptor, 'utf8');
        } finally {
            fs.closeSync(configFileDescriptor);
        }
    } else {
        contents = readOriginalConfig(selected);
        const temp = tl.getVariable('Agent.TempDirectory');
        if (!temp) {
            throw new Error(tl.loc('Error_GlobalConfigTempDirectory'));
        }
        const directory = fs.mkdtempSync(path.join(fs.realpathSync(temp), 'npmAuthenticate-global-'));
        const generatedGlobalConfigPath = path.join(directory, '.npmrc');
        try {
            restrictDirectory(directory);
            fs.writeFileSync(generatedGlobalConfigPath, '', { flag: 'wx', mode: 0o600 });
            state = {
                generatedGlobalConfigPath,
                directoryIdentifiers: getFileSystemObjectIdentifiers(fs.lstatSync(directory, { bigint: true })),
                configFileIdentifiers: getFileSystemObjectIdentifiers(fs.lstatSync(generatedGlobalConfigPath, { bigint: true })),
                originalGlobalConfigOverride: process.env.NPM_CONFIG_GLOBALCONFIG
                    ?? process.env.npm_config_globalconfig ?? null
            };
        } catch (error) {
            if (pathEntryExists(generatedGlobalConfigPath)) {
                fs.unlinkSync(generatedGlobalConfigPath);
            }
            fs.rmdirSync(directory);
            throw error;
        }
    }
    tl.setTaskVariable(stateVariable, JSON.stringify(state), true);
    let merged: string;
    try {
        merged = mergeGlobalCredentials(contents, entries);
    } catch {
        // Parsing errors may include secret-bearing input. Report only a fixed diagnostic.
        throw new Error(tl.loc('Error_GlobalConfigMerge'));
    }
    const configFileDescriptor = openVerifiedTaskGeneratedGlobalConfig(state);
    try {
        try {
            writeContents(configFileDescriptor, merged);
        } catch (error) {
            if (managed) {
                // A failed additional authentication step must not discard earlier credentials.
                writeContents(configFileDescriptor, contents);
            }
            throw error;
        }
    } finally {
        fs.closeSync(configFileDescriptor);
    }
    tl.setVariable(managedPathVariable, state.generatedGlobalConfigPath);
    tl.setVariable(managedStateVariable, JSON.stringify(state), true);
    tl.setVariable(selectionVariable, state.generatedGlobalConfigPath);
    tl.warning(tl.loc('Warning_GlobalConfigPrecedence'));
}

// Remove verified task-generated config paths and restore the prior selection unless another step changed it.
export function cleanupGlobalConfig(options: { onlyUnactivated?: boolean } = {}): void {
    const serialized = tl.getTaskVariable(stateVariable);
    if (!serialized) {
        return;
    }
    const state = parseState(serialized);
    if (options.onlyUnactivated && tl.getVariable(managedPathVariable) === state.generatedGlobalConfigPath) {
        return;
    }
    const directory = path.dirname(state.generatedGlobalConfigPath);
    if (!pathEntryExists(directory)) {
        return;
    }
    verifyTaskOwnedConfigDirectory(state);
    if (pathEntryExists(state.generatedGlobalConfigPath)) {
        const configFileDescriptor = openVerifiedTaskGeneratedGlobalConfig(state);
        fs.closeSync(configFileDescriptor);
        fs.unlinkSync(state.generatedGlobalConfigPath);
    }
    fs.rmdirSync(directory);
    if (tl.getVariable(selectionVariable) === state.generatedGlobalConfigPath) {
        tl.setVariable(selectionVariable, state.originalGlobalConfigOverride ?? '');
    }
    if (tl.getVariable(managedPathVariable) === state.generatedGlobalConfigPath) {
        tl.setVariable(managedPathVariable, '');
        tl.setVariable(managedStateVariable, '', true);
    }
}
