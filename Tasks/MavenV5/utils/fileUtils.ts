import * as fs from 'fs';
import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import * as shelljs from 'shelljs';

/**
 * Reads the file from by the path
 * @param filePath - Path to the file
 * @param encoding - encoding of the file. Default is "utf-8"
 * @returns string representation of the content
 */
export async function readFile(filePath: string, encoding?: BufferEncoding): Promise<string> {
    try {
        tl.debug(`Reading file at path: ${filePath}`);
        return new Promise<string>((resolve, reject) =>
            fs.readFile(filePath, (err, buffer) => {
                if (err) {
                    reject(err);
                }
                const fileData = buffer.toString(encoding ?? "utf-8");
                resolve(fileData);
            }))
    }
    catch (err) {
        tl.error(`Error when reading the file by path: ${filePath}`);
        throw err;
    }
}

/**
 * Writes the content for the file by path
 * @param filePath - Path to the file to write
 * @param fileContent - Content of the file to write
 * @param encoding - Encoding for the file content
 */
export function writeFile(filePath: string, fileContent: string, encoding?: BufferEncoding): void {
    try {
        const dirname = path.dirname(filePath);
        if (!fs.existsSync(dirname)) {
            fs.mkdirSync(dirname);
        }

        fs.writeFileSync(filePath, fileContent, { encoding: encoding ?? "utf-8" });
    }
    catch (err) {
        tl.error(`Error when writing to the file: ${err}`);
        throw err;
    }
}

/**
 * Copy the file to the destination path
 * @param sourcePath - Path to the source file
 * @param destinationPath - Path to the destination place
 */
export function copyFile(sourcePath: string, destinationPath: string): void {
    shelljs.cp('-f', sourcePath, destinationPath);

    const shellError: string = shelljs.error();
    if (shellError) {
        tl.error('cp failed');
        throw new Error(shellError);
    }
}
