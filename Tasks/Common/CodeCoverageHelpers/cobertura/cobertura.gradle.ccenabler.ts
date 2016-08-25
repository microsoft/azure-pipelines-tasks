/// <reference path="../../../../definitions/Q.d.ts" />
/// <reference path="../../../../definitions/string.d.ts" />
/// <reference path="../../../../definitions/node.d.ts" />
/// <reference path="../../../../definitions/vsts-task-lib.d.ts" />

import * as util from '../utilities';
import * as tl from 'vsts-task-lib/task';
import * as ccc from '../codecoverageconstants';
import {CodeCoverageEnabler} from '../codecoverageenabler';
import * as str from 'string';
import * as os from 'os';

export class CoberturaGradleCodeCoverageEnabler extends CoberturaCodeCoverageEnabler {
    //-----------------------------------------------------
    // Enable code coverage for Cobertura Gradle Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    //-----------------------------------------------------    
    public enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean> {
        let defer = Q.defer<boolean>();
        let _this = this;

        _this.buildFile = ccProps['buildFile'];
        let classFilter = ccProps['classFilter'];
        let isMultiModule = ccProps['isMultiModule'];
        let classFileDirs = ccProps['classFileDirs'];
        let reportDir = ccProps['reportDir'];
        let codeCoveragePluginData = null;

        let filter = _this.extractFilters(classFilter);
        let cobExclude = _this.applyCoberturaFilterPattern(filter.excludeFilter);
        let cobInclude = _this.applyCoberturaFilterPattern(filter.includeFilter);

        if (isMultiModule) {
            codeCoveragePluginData = ccc.coberturaGradleMultiModuleEnable(cobExclude.join(","), cobInclude.join(","), classFileDirs, null, reportDir);
        } else {
            codeCoveragePluginData = ccc.coberturaGradleSingleModuleEnable(cobExclude.join(","), cobInclude.join(","), classFileDirs, null, reportDir);
        }

        if (codeCoveragePluginData) {
            tl.debug("Code Coverage data will be appeneded to build file: " + _this.buildFile);
            util.insertTextToFileSync(_this.buildFile, ccc.coberturaGradleBuildScript, codeCoveragePluginData);
            tl.debug("Appended code coverage data");
            defer.resolve(true);
        } else {
            tl.warning("Unable to append code coverage data");
            defer.reject("");
        }

        return defer.promise;
    }
}