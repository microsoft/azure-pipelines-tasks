import * as semver from 'semver';

/** Convert versions like `3.8-dev` to a version like `>= 3.8.0-a0`. */
export function desugarDevVersion(versionSpec: string) {
    if (versionSpec.endsWith('-dev')) {
        const versionRoot = versionSpec.slice(0, -'-dev'.length);
        return `>= ${versionRoot}.0-a0`;
    } else {
        return versionSpec;
    }
}

/**
 * Python's prelease versions look like `3.7.0b2`.
 * This is the one part of Python versioning that does not look like semantic versioning, which specifies `3.7.0-b2`.
 * If the version spec contains prerelease versions, we need to convert them to the semantic version equivalent.
 */
export function pythonVersionToSemantic(versionSpec: string) {
    const prereleaseVersion = /(\d+\.\d+\.\d+)((?:a|b|rc)\d*)/g;
    return versionSpec.replace(prereleaseVersion, '$1-$2');
}

/**
 * Checks if at least the patch field is present in the version specification
 * @param versionSpec version specification
 */
export function isExactVersion(versionSpec: string): boolean {
    if (!versionSpec) {
        return false;
    }
    const versionNumberParts = versionSpec.split('.');

    return versionNumberParts.length >= 3;
}
