import semver = require('semver');
import * as tl from 'azure-pipelines-task-lib/task';

const scopedPackageNamePattern = /^@([^/]+)\/([^/]+)$/;
const disallowedNewPackageNameCharacters = /[~'!()*]/;
const archivePackageSpecPattern = /[.](?:tgz|tar.gz|tar)$/i;
const printableAsciiPattern = /^[\x20-\x7E]+$/;
const registryTagPattern = /^[A-Za-z0-9._-]+$/;

export function getValidatedNpmPackageSpec(packageName: string, packageVersion: string): string {
    const expectedName = `@${packageName}`;

    if (!isValidScopedPackageName(expectedName)) {
        throw new Error(tl.loc('Error_InvalidNpmPackageName'));
    }

    const trimmedVersion = packageVersion.trim();
    if (!isRegistryVersionRangeOrTag(trimmedVersion)) {
        throw new Error(tl.loc('Error_InvalidNpmPackageVersion'));
    }

    return `${expectedName}@${trimmedVersion}`;
}

function isValidScopedPackageName(packageName: string): boolean {
    if (packageName.length > 214
        || packageName !== packageName.toLowerCase()
        || disallowedNewPackageNameCharacters.test(packageName)) {
        return false;
    }

    const match = scopedPackageNamePattern.exec(packageName);
    if (!match) {
        return false;
    }

    const scope = match[1];
    const name = match[2];
    if (name === '.' || name === '..' || scope === '.' || scope === '..') {
        return false;
    }

    return encodeURIComponent(scope) === scope && encodeURIComponent(name) === name;
}

function isRegistryVersionRangeOrTag(packageVersion: string): boolean {
    if (!printableAsciiPattern.test(packageVersion)) {
        return false;
    }

    if (archivePackageSpecPattern.test(packageVersion)) {
        return false;
    }

    if (semver.valid(packageVersion) !== null || semver.validRange(packageVersion) !== null) {
        return true;
    }

    return !packageVersion.startsWith('.') && registryTagPattern.test(packageVersion);
}
