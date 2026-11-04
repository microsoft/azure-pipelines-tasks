import path = require('path');

export function isPathInside(root: string, candidate: string): boolean {
    const resolvedRoot = path.resolve(root);
    const resolvedCandidate = path.resolve(candidate);
    const relative = path.relative(resolvedRoot, resolvedCandidate);
    return relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
}

// Returns the first entry whose extraction target would fall outside the extraction root, or undefined.
export function findEntryOutsideRoot(root: string, entries: string[]): string | undefined {
    for (const entry of entries) {
        const normalized = entry.replace(/\\/g, '/');
        if (path.isAbsolute(normalized) || path.win32.isAbsolute(entry) || !isPathInside(root, path.join(root, normalized))) {
            return entry;
        }
    }

    return undefined;
}
