/// <reference path="../../../../definitions/Q.d.ts" />
/// <reference path="../../../../definitions/string.d.ts" />
/// <reference path="../../../../definitions/vsts-task-lib.d.ts" />
/// <reference path="../../../../definitions/node.d.ts" />

import * as util from "../utilities";
import * as tl from "vsts-task-lib/task";
import * as ccc from "../codecoverageconstants";
import * as cc from "../codecoverageenabler";
import * as str from "string";
import * as os from "os";
import * as Q from "q";

export class CoberturaGradleCodeCoverageEnabler extends cc.CoberturaCodeCoverageEnabler {
    // -----------------------------------------------------
    // Enable code coverage for Cobertura Gradle Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    // -----------------------------------------------------    
    public enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean> {
        let _this = this;

        _this.buildFile = ccProps["buildfile"];
        let classFilter = ccProps["classfilter"];
        let isMultiModule = ccProps["ismultimodule"] && ccProps["ismultimodule"] === "true";
        let classFileDirs = ccProps["classfilesdirectories"];
        let reportDir = ccProps["reportdirectory"];
        let codeCoveragePluginData = null;

        let filter = _this.extractFilters(classFilter);
        let cobExclude = _this.applyFilterPattern(filter.excludeFilter);
        let cobInclude = _this.applyFilterPattern(filter.includeFilter);

        if (isMultiModule) {
            codeCoveragePluginData = ccc.coberturaGradleMultiModuleEnable(cobExclude.join(","), cobInclude.join(","), classFileDirs, null, reportDir);
        } else {
            codeCoveragePluginData = ccc.coberturaGradleSingleModuleEnable(cobExclude.join(","), cobInclude.join(","), classFileDirs, null, reportDir);
        }

        try {
            console.log("Code Coverage data will be appeneded to build file: " + _this.buildFile);
            util.insertTextToFileSync(_this.buildFile, ccc.coberturaGradleBuildScript, codeCoveragePluginData);
            console.log("Appended code coverage data");
        } catch (error) {
            return Q.reject<boolean>(error);
        }
        return Q.resolve(true);
    }

    protected applyFilterPattern(filter: string): string[] {
        let ccfilter = [];
        let _this = this;

        if (!util.isNullOrWhitespace(filter)) {
            util.trimToEmptyString(filter).split(":").forEach(exFilter => {
                if (exFilter) {
                    ccfilter.push(str(exFilter).endsWith("*") ? ("'.*" + util.trimEnd(exFilter, "*") + ".*'") : ("'.*" + exFilter + "'"));
                }
            });
        }

        return ccfilter;
    }
}