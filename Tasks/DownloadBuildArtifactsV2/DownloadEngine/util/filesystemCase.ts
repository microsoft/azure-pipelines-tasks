import * as fs from 'fs';
import * as path from 'path';

export type CaseProbeFileSystem = Pick<typeof fs, 'existsSync' | 'readdirSync' | 'statSync' | 'lstatSync'>;

/** True when the folder has an entry of this name; a symbolic link counts even when what it points to is not there. */
function hasEntry(entryPath: string, fileSystem: CaseProbeFileSystem): boolean {
    try {
        fileSystem.lstatSync(entryPath);
        return true;
    } catch {
        return false;
    }
}

/** The name with the case of its first letter changed, or undefined when it holds no letter A to Z. */
function caseVariant(name: string): string | undefined {
    for (let index = 0; index < name.length; index++) {
        const character = name.charAt(index);
        if (character >= 'a' && character <= 'z') {
            return name.substring(0, index) + character.toUpperCase() + name.substring(index + 1);
        }
        if (character >= 'A' && character <= 'Z') {
            return name.substring(0, index) + character.toLowerCase() + name.substring(index + 1);
        }
    }
    return undefined;
}

/** True or false when the folder has an entry that tells, undefined when it holds nothing with a letter in its name. */
function probeFolder(folder: string, fileSystem: CaseProbeFileSystem): boolean | undefined {
    const entries = fileSystem.readdirSync(folder);
    for (const entry of entries) {
        const variant = caseVariant(entry);
        if (variant === undefined) {
            continue;
        }
        // Two entries that differ only in case prove that the names are case-sensitive.
        if (entries.filter(candidate => candidate.toLowerCase() === entry.toLowerCase()).length !== 1) {
            return false;
        }
        return hasEntry(path.join(folder, variant), fileSystem);
    }
    return undefined;
}

/**
 * Whether the file system that holds `destinationPath` ignores the case of names, like the file system of Windows and the usual one of macOS.
 * No file is created: an entry of the nearest existing folder is asked for with the case of one letter changed. An empty folder (or one
 * without letters in its names) is judged by its parent, as long as that is on the same device. When nothing can be told, or anything
 * fails, the answer is false, which keeps the matching case-sensitive.
 */
export function isFilesystemCaseInsensitive(destinationPath: string, fileSystem: CaseProbeFileSystem = fs): boolean {
    if (!destinationPath) {
        return false;
    }
    try {
        let existing = path.resolve(destinationPath);
        for (;;) {
            if (fileSystem.existsSync(existing)) {
                const answer = probeFolder(existing, fileSystem);
                if (answer !== undefined) {
                    return answer;
                }
                const parent = path.dirname(existing);
                if (parent === existing || fileSystem.statSync(existing).dev !== fileSystem.statSync(parent).dev) {
                    return false;
                }
                existing = parent;
                continue;
            }
            const parent = path.dirname(existing);
            if (parent === existing) {
                return false;
            }
            existing = parent;
        }
    } catch {
        return false;
    }
}
