import * as path from 'path';
import * as os from 'os';
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import { BicepCache } from '@azure/bicep-deploy-common';

const TOOL_NAME = 'bicep';

function getBinaryName(): string {
    return os.platform() === 'win32' ? 'bicep.exe' : 'bicep';
}

export class TaskBicepCache implements BicepCache {
    async find(version: string): Promise<string | undefined> {
        const cached = toolLib.findLocalTool(TOOL_NAME, version);
        if (cached) {
            return path.join(cached, getBinaryName());
        }

        return undefined;
    }

    async save(installedPath: string, version: string): Promise<string> {
        const cachedDir = await toolLib.cacheFile(
            installedPath,
            getBinaryName(),
            TOOL_NAME,
            version,
        );

        return path.join(cachedDir, getBinaryName());
    }
}
