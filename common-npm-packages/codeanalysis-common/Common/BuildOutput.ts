import { ModuleOutput } from './ModuleOutput';

import path = require('path');
import fs = require('fs');
import glob = require('glob');

import * as tl from 'azure-pipelines-task-lib/task';

export enum BuildEngine {
    Maven,
    Gradle
}

/**
 * Build output from a single or multi module project. Identifies modules based on path conventions. 
 * 
 * @export
 * @class BuildOutput
 * @implements {IBuildOutput}
 */
export class BuildOutput {
    constructor(private rootDirectory: string, public buildEngine: BuildEngine) { }

    /**
     * Finds the module outputs by looking at the file structure. In Gradle the modules are in the "build" 
     * 
     * @returns {ModuleOutput[]}
     */
    public findModuleOutputs(): ModuleOutput[] {
        let moduleOutputs: ModuleOutput[] = [];
        let modulePaths: string[] = glob.sync(path.join(this.rootDirectory, '**', this.getBuildDirectoryName()))
            .filter((dir) => fs.lstatSync(dir).isDirectory());

        for (let modulePath of modulePaths) {
            let moduleName: string = this.getModuleName(modulePath);
            let mo: ModuleOutput = new ModuleOutput(moduleName, modulePath);
            tl.debug(`[CA] Candidate module: ${mo.moduleName} - root ${mo.moduleRoot}`);
            moduleOutputs.push(mo);
        }

        return moduleOutputs;
    }

    private getModuleName(modulePath: string): string {
        let rootBuildDir: string = path.join(this.rootDirectory, this.getBuildDirectoryName());
        tl.debug(`[CA] modulePath: ${modulePath} rootBuildDir: ${rootBuildDir}`);

        if (path.normalize(modulePath) === path.normalize(rootBuildDir)) {
            return 'root';
        }
        return path.basename(path.join(modulePath, '..'));
    }

    private getBuildDirectoryName(): string {
        switch (this.buildEngine) {
            case BuildEngine.Gradle:
                return 'build';
            case BuildEngine.Maven:
                return 'target';
            default:
                tl.debug(`Unknown build engine value.`);
                return null;
        }
    }
}
