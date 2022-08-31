
import * as util from "../utilities";
import * as tl from 'azure-pipelines-task-lib/task';
import * as ccc from "../codecoverageconstants";
import * as cc from "../codecoverageenabler";
import * as Q from "q";
import * as path from "path";

tl.setResourcePath(path.join(path.dirname(__dirname), 'module.json'), true);

export class JacocoGradleCodeCoverageEnabler extends cc.JacocoCodeCoverageEnabler {
    // -----------------------------------------------------
    // Enable code coverage for Jacoco Gradle Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    // -----------------------------------------------------
    public enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<string> {
        let _this = this;

        tl.debug("Input parameters: " + JSON.stringify(ccProps));

        _this.buildFile = ccProps["buildfile"];
        let classFilter = ccProps["classfilter"];
        let isMultiModule = ccProps["ismultimodule"] && ccProps["ismultimodule"] === "true";
        let classFileDirs = ccProps["classfilesdirectories"];
        let reportDir = ccProps["reportdirectory"];
        let gradle5xOrHigher = ccProps["gradle5xOrHigher"] && ccProps["gradle5xOrHigher"] === "true";
        let codeCoveragePluginData = null;

        let filter = _this.extractFilters(classFilter);
        let jacocoExclude = _this.applyFilterPattern(filter.excludeFilter);
        let jacocoInclude = _this.applyFilterPattern(filter.includeFilter);

        if (isMultiModule) {
            codeCoveragePluginData = ccc.jacocoGradleMultiModuleEnable(jacocoExclude.join(","), jacocoInclude.join(","), classFileDirs, reportDir, gradle5xOrHigher);
        } else {
            codeCoveragePluginData = ccc.jacocoGradleSingleModuleEnable(jacocoExclude.join(","), jacocoInclude.join(","), classFileDirs, reportDir, gradle5xOrHigher);
        }

        try {
            tl.debug("Code Coverage data will be appeneded to build file: " + this.buildFile);
            util.appendTextToFileSync(this.buildFile, codeCoveragePluginData);
            tl.debug("Appended code coverage data");
        } catch (error) {
            tl.warning(tl.loc("FailedToAppendCC", error));
            return Q.reject(tl.loc("FailedToAppendCC", error));
        }
        return Q.resolve('');
    }

    protected applyFilterPattern(filter: string): string[] {
        let ccfilter = [];

        if (!util.isNullOrWhitespace(filter)) {
            util.trimToEmptyString(filter).replace(/\./g, "/").split(":").forEach(exFilter => {
                if (exFilter) {
                    ccfilter.push(exFilter.endsWith("*") ? ("'" + exFilter + "/**'") : ("'" + exFilter + ".class'"));
                }
            });
        }

        tl.debug("Applying the filter pattern: " + filter + " op: " + ccfilter);
        return ccfilter;
    }
}
