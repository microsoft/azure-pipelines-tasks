import * as fs from 'fs';
import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import * as shelljs from 'shelljs'

export async function readFile(filePath: string, encoding: string) {

    tl.debug('Reading file at path ' + filePath)

    return new Promise<string>((resolve, reject) =>
        fs.readFile(filePath, (err, buffer) => {
            const fileData = buffer.toString(encoding)
            resolve(fileData)
        })
    )
}

export function writeFile(filePath: string, fileContent: string) {
    try {
        const dirname = path.dirname(filePath)
        if (!fs.existsSync(dirname)) {
            fs.mkdirSync(dirname);
        }

        fs.writeFileSync(filePath, fileContent, { encoding: "utf-8" });
    }
    catch (err) {
        tl.error(`Error when writing to the file:${err}`)
        throw err
    }
}

export function copyFile(sourcePath: string, destinationPath: string): void {
    shelljs.cp('-f', sourcePath, destinationPath);

    const shellError: string = shelljs.error();
    if (shellError) {
        tl.error('cp failed');
        throw new Error(shellError);
    }
}
