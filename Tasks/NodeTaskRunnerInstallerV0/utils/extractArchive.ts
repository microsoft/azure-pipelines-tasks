// TODO: Reuse in node-installer-common
import * as path from 'path';
import * as os from 'os';

import * as toolLib from 'azure-pipelines-tool-lib/tool';

/**
 * Extracts archive.
 * @param archivePath Path to archive.
 * @returns Path to extracted archive.
 */
export async function extractArchive(archivePath: string): Promise<string> {

    if (os.platform() === 'win32') {
        const pathTo7z = path.resolve(__dirname, '..', 'externals', '7zr.exe');

        return await toolLib.extract7z(archivePath, undefined, pathTo7z);
    }

    return await toolLib.extractTar(archivePath);
}
