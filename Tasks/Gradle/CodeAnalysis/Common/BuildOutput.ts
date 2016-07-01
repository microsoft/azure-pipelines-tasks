import {ModuleOutput} from './ModuleOutput';

import path = require('path');
import fs = require('fs');
import glob = require('glob');

import tl = require('vsts-task-lib/task');



/**
 * Build output from a single or multi module project. Identifies modules based on path conventions. 
 * 
 * @export
 * @class BuildOutput
 * @implements {IBuildOutput}
 */
export class BuildOutput {

    private moduleOutputs: ModuleOutput[] = [];

    constructor(private rootDirectory: string, private buildOutputDirName: string) {
        this.findCandidateModuleOutputs();
    }

    public getModuleOutputs(): ModuleOutput[] {
        return this.moduleOutputs;
    }

    private findCandidateModuleOutputs() {

        let modulePaths = glob.sync(path.join(this.rootDirectory, '**', this.buildOutputDirName))
            .filter((dir) => fs.lstatSync(dir).isDirectory());

        for (var modulePath of modulePaths) {

            let moduleName = this.getModuleName(modulePath);
            let mo = new ModuleOutput(moduleName, modulePath);
            tl.debug(`[CA] Candidate module: ${mo.moduleName} - root ${mo.moduleRoot}`)
            this.moduleOutputs.push(mo);
        }
    }

    private getModuleName(modulePath: string): string {
        // we cannot use the parent directory as module name for top-level modules  
        if (modulePath === this.rootDirectory) {
            return 'root';
        }
        return path.basename(path.join(modulePath, '..'));
    }

}
