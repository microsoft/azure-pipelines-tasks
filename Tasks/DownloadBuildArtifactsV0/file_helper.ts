import { Stats, statSync as getFile } from 'fs';

/**
 * Get size of file on local storage
 * @param  {string} path - path to the file in local storage
 * @throws Exception if path to the file is empty
 * @returns Size of the file in bytes
 */
export function getFileSizeInBytes(path: string): number {
    let fileSize: number = 0;

    if (path) {
        // TODO: Add support of BigInt after migration on Node10
        const file: Stats = getFile(path);
        fileSize = file.size;
    } else {
        throw 'Path to the file is empty';
    }

    return fileSize;
}
