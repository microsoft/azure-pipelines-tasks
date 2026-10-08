import semver = require('semver');

interface NpmArgumentWriter {
    arg(argument: string): void;
    line(command: string): void;
}

const scopedPackageNamePattern = /^@([^/]+)\/([^/]+)$/;
const disallowedNewPackageNameCharacters = /[~'!()*]/;
const archivePackageSpecPattern = /\.(?:tgz|tar|tar\.gz)$/i;

export function getValidatedNpmPackageSpec(packageName: string, packageVersion: string): string {
    const expectedName = `@${packageName}`;

    if (!isValidScopedPackageName(expectedName)) {
        throw new Error('Package name must be a valid scoped npm package name.');
    }

    if (!isRegistryVersionRangeOrTag(packageVersion)) {
        throw new Error('Package version must be a registry version, range, or tag.');
    }

    return `${expectedName}@${packageVersion}`;
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
    if (packageVersion === '' || packageVersion.trim() !== packageVersion) {
        return false;
    }

    if (semver.valid(packageVersion) !== null || semver.validRange(packageVersion) !== null) {
        return true;
    }

    return !packageVersion.startsWith('.')
        && !archivePackageSpecPattern.test(packageVersion)
        && encodeURIComponent(packageVersion) === packageVersion;
}

export function getNpmArguments(
    packageDownloadPath: string,
    packageName: string,
    packageVersion: string
): string[] {
    const packageSpec = getValidatedNpmPackageSpec(packageName, packageVersion);
    return ['install', '--prefix', packageDownloadPath, packageSpec];
}

export function setNpmArguments(
    npm: NpmArgumentWriter,
    packageDownloadPath: string,
    packageName: string,
    packageVersion: string,
    isArgumentIsolationFixEnabled: boolean
): void {
    if (isArgumentIsolationFixEnabled) {
        for (const argument of getNpmArguments(packageDownloadPath, packageName, packageVersion)) {
            npm.arg(argument);
        }
    } else {
        const packageSpec = `@${packageName}${packageVersion ? `@${packageVersion}` : ''}`;
        npm.line(`install --prefix ${packageDownloadPath} ${packageSpec}`);
    }
}
