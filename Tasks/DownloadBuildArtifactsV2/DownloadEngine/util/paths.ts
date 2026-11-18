import * as fs from 'fs';
import * as path from 'path';
import { ArtifactError } from '../errors';

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
const WINDOWS_INVALID = /[<>:"|?*\\\u0000-\u001f]/;

export class UnsafePathError extends ArtifactError { }

/**
 * Splits an artifact path ("/dir/file.txt") into validated segments. Paths come from the service, so
 * anything that could leave the destination directory or address a device is rejected.
 */
export function artifactPathSegments(artifactPath: string, platform: NodeJS.Platform = process.platform): string[] {
    if (typeof artifactPath !== 'string' || artifactPath.includes('\u0000')) {
        throw new UnsafePathError('An artifact path contains an invalid character.');
    }

    const segments = artifactPath.split('/');
    if (segments[0] === '') {
        segments.shift();
    }
    if (segments.length === 0) {
        throw new UnsafePathError('An artifact path is empty.');
    }

    for (const segment of segments) {
        if (segment === '' || segment === '.' || segment === '..') {
            throw new UnsafePathError(`The artifact path '${artifactPath}' is not a valid relative path.`);
        }
        if (platform === 'win32') {
            if (WINDOWS_INVALID.test(segment) || /[. ]$/.test(segment) || WINDOWS_RESERVED.test(segment)) {
                throw new UnsafePathError(`The artifact path '${artifactPath}' cannot be created on Windows.`);
            }
        }
    }
    return segments;
}

/** True when a relative path (as returned by path.relative) leaves its base directory. A name that merely starts with two dots, like "..data", does not. */
export function leavesBase(relative: string): boolean {
    return relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative);
}

export function resolveInside(root: string, segments: readonly string[]): string {
    const base = path.resolve(root);
    const resolved = path.resolve(base, ...segments);
    const relative = path.relative(base, resolved);
    if (relative === '' || leavesBase(relative)) {
        throw new UnsafePathError(`The artifact path '${segments.join('/')}' resolves outside of '${root}'.`);
    }
    return resolved;
}

/** Throws when a symbolic link under `directory` cannot be resolved or resolves to a place outside of `directory`. */
export async function assertLinksInside(directory: string): Promise<void> {
    const root = await fs.promises.realpath(directory);
    const pending = [directory];
    while (pending.length > 0) {
        const current = pending.pop()!;
        for (const entry of await fs.promises.readdir(current, { withFileTypes: true })) {
            const entryPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                pending.push(entryPath);
            } else if (entry.isSymbolicLink()) {
                const target = await fs.promises.realpath(entryPath).catch(() => undefined);
                if (target === undefined) {
                    throw new UnsafePathError(`The archive contains a symbolic link that cannot be resolved: ${entryPath}`);
                }
                if (leavesBase(path.relative(root, target))) {
                    throw new UnsafePathError(`The archive contains a symbolic link that points outside of its folder: ${entryPath} -> ${target}`);
                }
            }
        }
    }
}
