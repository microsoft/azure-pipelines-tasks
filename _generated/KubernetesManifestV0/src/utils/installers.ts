import * as os from 'os';
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import * as fs from 'fs';

export abstract class Installer {
    public checkIfExists: () => string; // Return empty string if it doesn't exist
    public install: () => Promise<string>;
    protected getExecutableExtension () {
        switch (os.type()) {
            case 'Windows_NT':
                return `.exe`;
            default:
                return ``;
        }
    }
}

export class KomposeInstaller extends Installer {
    public checkIfExists = () => {
        try {
            const toolPath = tl.which(this.toolName, true);
            return toolPath;
        } catch (ex) {
            // Finding in tool lib cache
            const toolPath = toolLib.findLocalTool(this.toolName, this.defaultVersion);
            if (toolPath) {
                return path.join(toolPath, this.tool);
            }
            return '';
        }
    }

    public install = async (): Promise<string> => {
        let toolPath = await toolLib.downloadTool(this.getDownloadUrl(), this.toolName);
        const cachedFolderPath = await toolLib.cacheFile(toolPath, this.tool, this.toolName, this.defaultVersion);
        toolPath = path.join(cachedFolderPath, this.tool);
        fs.chmodSync(toolPath, 0o100); // execute/search by owner permissions to the tool
        return path.join(cachedFolderPath, this.tool);
    }

    private getDownloadUrl(): string {
        switch (os.type()) {
            case 'Linux':
                return `https://github.com/kubernetes/kompose/releases/download/${this.defaultVersion}/kompose-linux-amd64`;
            case 'Darwin':
                return `https://github.com/kubernetes/kompose/releases/download/${this.defaultVersion}/kompose-darwin-amd64`;
            case 'Windows_NT':
                return `https://github.com/kubernetes/kompose/releases/download/${this.defaultVersion}/kompose-windows-amd64.exe`;
            default:
                throw Error('Unknown OS type');
        }
    }

    public defaultVersion: string = 'v1.18.0';
    public toolName: string = 'kompose';
    public tool: string = `${this.toolName}${this.getExecutableExtension()}`;
}