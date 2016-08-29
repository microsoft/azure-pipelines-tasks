/// <reference path="../../../../definitions/Q.d.ts" />
/// <reference path="../../../../definitions/string.d.ts" />
/// <reference path="../../../../definitions/vsts-task-lib.d.ts" />
/// <reference path="../../../../definitions/node.d.ts" />

import * as util from "../utilities";
import * as tl from "vsts-task-lib/task";
import * as ccc from "../codecoverageconstants";
import * as cc from "../codecoverageenabler";
import * as str from "string";
import * as path from "path";
import * as os from "os";
import * as Q from "q";

export class JacocoGradleCodeCoverageEnabler extends cc.JacocoCodeCoverageEnabler {
    // -----------------------------------------------------
    // Enable code coverage for Jacoco Gradle Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    // -----------------------------------------------------    
    public enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean> {
        let _this = this;

        _this.buildFile = ccProps["buildFile"];
        let classFilter = ccProps["classFilter"];
        let isMultiModule = ccProps["isMultiModule"] && ccProps["isMultiModule"] === "true";
        let classFileDirs = ccProps["classFileDirs"];
        let reportDir = ccProps["reportDir"];
        let codeCoveragePluginData = null;

        let filter = _this.extractFilters(classFilter);
        let jacocoExclude = _this.applyJacocoFilterPattern(filter.excludeFilter);
        let jacocoInclude = _this.applyJacocoFilterPattern(filter.includeFilter);

        if (isMultiModule) {
            codeCoveragePluginData = ccc.jacocoGradleMultiModuleEnable(jacocoExclude.join(","), jacocoInclude.join(","), classFileDirs, reportDir);
        } else {
            codeCoveragePluginData = ccc.jacocoGradleSingleModuleEnable(jacocoExclude.join(","), jacocoInclude.join(","), classFileDirs, reportDir);
        }

        try {
            console.log("Code Coverage data will be appeneded to build file: " + this.buildFile);
            util.appendTextToFileSync(this.buildFile, codeCoveragePluginData);
            console.log("Appended code coverage data");
        } catch (error) {
            console.error("Unable to append code coverage data " + error);
            return Q.reject<boolean>(error);
        }
        return Q.resolve<boolean>(true);
    }
}