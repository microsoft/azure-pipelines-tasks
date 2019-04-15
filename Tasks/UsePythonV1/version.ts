/** Convert versions like `3.8-dev` to a version like `>= 3.8.0-a0`. */
export function desugarDevVersion(version: string | undefined): string {
    if (!version) {
        throw('Version is required.');
    }

    if (version.endsWith('-dev')) {
        const versionRoot = version.slice(0, -'-dev'.length);
        return `>= ${versionRoot}.0-a0`;
    } else {
        return version;
    }
}

/**
 * Python's prelease versions look like `3.7.0b2`.
 * This is the one part of Python versioning that does not look like semantic versioning, which specifies `3.7.0-b2`.
 * If the version spec contains prerelease versions, we need to convert them to the semantic version equivalent.
 */
export function pythonVersionToSemantic(version: string | undefined): string {
    if (!version) {
        throw('Version is required.');
    }

    const prereleaseVersion = /(\d+\.\d+\.\d+)((?:a|b|rc)\d*)/g;
    return version.replace(prereleaseVersion, '$1-$2');
}
