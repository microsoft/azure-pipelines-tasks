import * as tl from 'azure-pipelines-task-lib/task';
import * as os from 'os';

import { ToolRunner } from 'azure-pipelines-task-lib/toolrunner';

/**
 * Returns promise which will be resolved in given number of milliseconds.
 * @param sleepDurationInMilliSeconds Number of milliseconds.
 * @returns Promise<any>
 */
export function sleepFor(sleepDurationInMilliSeconds: number): Promise<any> {    
    return new Promise((resolve, reject) => {
        setTimeout(resolve, sleepDurationInMilliSeconds);
    });
}

/**
 * Run a tool with `sudo` on Linux and macOS.
 * Precondition: `toolName` executable is in PATH.
 * @returns ToolRunner
 */
export function sudo(toolName: string): ToolRunner {
    if (os.platform() === 'win32') {
        return tl.tool(toolName);
    } else {
        const toolPath = tl.which(toolName);
        return tl.tool('sudo').line(toolPath);
    }
}

/**
 * Attach a disk image.
 * Only for macOS.
 * Returns promise with return code.
 * @param sourceFile Path to a disk image file.
 * @returns number
 */
export async function attach(sourceFile: string): Promise<number> {
    console.log(tl.loc('AttachDiskImage'));
    const hdiutil = sudo('hdiutil');
    hdiutil.line(`attach "${sourceFile}"`);
    return await hdiutil.exec();
}

/**
 * Detach a disk image.
 * Only for macOS.
 * Returns promise with return code.
 * @param volumePath Path to the attached disk image.
 * @returns number
 */
export async function detach(volumePath: string): Promise<number> {
    console.log(tl.loc('DetachDiskImage'));
    const hdiutil = sudo('hdiutil');
    hdiutil.line(`detach "${volumePath}"`);
    return await hdiutil.exec();
}
