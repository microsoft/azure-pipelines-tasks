/// <reference path="../../../definitions/Q.d.ts" />
/// <reference path="../../../definitions/string.d.ts" />
/// <reference path="../../../definitions/node.d.ts" />
/// <reference path="../../../definitions/vsts-task-lib.d.ts" />

import * as util from './utilities';
import * as tl from 'vsts-task-lib/task';
import * as ccc from './codecoverageconstants';
import {CodeCoverageEnabler} from './codecoverageenabler';
import * as str from 'string';

export class CoberturaGradleCodeCoverageEnabler extends CodeCoverageEnabler {
    //-----------------------------------------------------
    // Enable code coverage for Cobertura Gradle Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    //-----------------------------------------------------    
    public enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean> {
        var defer = Q.defer<boolean>();
        var _this = this;

        var buildFile = ccProps['buildFile'];
        var classFilter = ccProps['classFilter'];
        var isMultiModule = ccProps['isMultiModule'];
        var classFileDirs = ccProps['classFileDirs'];
        var reportDir = ccProps['reportDir'];
        var codeCoveragePluginData = null;

        var filter = _this.extractFilters(classFilter);
        var cobExclude = _this.applyCoberturaFilterPattern(filter.excludeFilter);
        var cobInclude = _this.applyCoberturaFilterPattern(filter.includeFilter);

        if (isMultiModule) {
            codeCoveragePluginData = ccc.coberturaGradleMultiModuleEnable(cobExclude.join(","), cobInclude.join(","), classFileDirs, null, reportDir);
        } else {
            codeCoveragePluginData = ccc.coberturaGradleSingleModuleEnable(cobExclude.join(","), cobInclude.join(","), classFileDirs, null, reportDir);
        }

        if (codeCoveragePluginData) {
            tl.debug("Code Coverage data will be appeneded to build file: " + buildFile);
            util.insertTextToFileSync(buildFile, ccc.coberturaGradleBuildScript, codeCoveragePluginData);
            tl.debug("Appended code coverage data");
            defer.resolve(true);
        } else {
            tl.warning("Unable to append code coverage data");
            defer.resolve(false);
        }

        return defer.promise;
    }

    private applyCoberturaFilterPattern(filter: string): string[] {
        var coberturaFilter = [];
        var _this = this;

        if (!util.isNullOrWhitespace(filter)) {
            util.trimToEmptyString(filter).split(":").forEach(exFilter => {
                if (exFilter) {
                    coberturaFilter.push(str(exFilter).endsWith("*") ? ("'.*" + util.trimEnd(exFilter, "*") + ".*'") : ("'.*" + exFilter + "'"));
                }
            });
        }

        return coberturaFilter;
    }
}