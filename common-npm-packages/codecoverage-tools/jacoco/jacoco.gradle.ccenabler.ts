
import * as util from "../utilities";
import * as tl from 'azure-pipelines-task-lib/task';
import * as ccc from "../codecoverageconstants";
import * as cc from "../codecoverageenabler";
import * as Q from "q";
import * as path from "path";
import * as semver from "semver";

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
        const gradleVersion = ccProps["gradleVersion"];
        const useJacocoTemplateV2forSingleModule = ccProps['useJacocoTemplateV2forSingleModule'] && ccProps['useJacocoTemplateV2forSingleModule'] === 'true';
        const useJacocoTemplateV2forMultiModule = ccProps['useJacocoTemplateV2forMultiModule'] && ccProps['useJacocoTemplateV2forMultiModule'] === 'true';
        const useTemplateV2FFisEnabled = isMultiModule && useJacocoTemplateV2forMultiModule || !isMultiModule && useJacocoTemplateV2forSingleModule;

        let filter = _this.extractFilters(classFilter);
        let jacocoExclude = _this.applyFilterPattern(filter.excludeFilter);
        let jacocoInclude = _this.applyFilterPattern(filter.includeFilter);

        const jacocoGradleEnabler = _this.getJacocoGradleEnablerFunction(isMultiModule, gradleVersion, useTemplateV2FFisEnabled);
        codeCoveragePluginData = jacocoGradleEnabler(jacocoExclude.join(","), jacocoInclude.join(","), classFileDirs, reportDir, gradle5xOrHigher);

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

    /*
    * Returns the appropriate Jacoco Gradle enabler function based on the project's Gradle version and module type.
    * @param isMultiModule - A boolean indicating whether the project is a multi-module project.
    * @param gradleVersion - The version of gradle used by the project.
    * @returns The appropriate Jacoco Gradle enabler function.
    * @throws An error if the Gradle version or module type is not supported.
    */
    private getJacocoGradleEnablerFunction(isMultiModule: boolean, gradleVersion: string, useTemplateV2FFisEnabled: boolean) {
      const modeleType = isMultiModule ? "multi" : "single";
      const resolvedGradleVersion = semver.valid(semver.coerce(gradleVersion));

      // if gradle version is 'unknown' or below 6.1.0, use V1 template
      const templateVersion = resolvedGradleVersion && semver.gte(resolvedGradleVersion, '6.1.0') && useTemplateV2FFisEnabled ? "V2" : "V1";

      tl.debug(`Gradle module type: ${modeleType}, Gradle version: ${gradleVersion}, ResolvedGradleVersion: ${resolvedGradleVersion} Template version: ${templateVersion}`)

      switch (modeleType + "-" + templateVersion) {
          case "multi-V1":
              return ccc.jacocoGradleMultiModuleEnable;
          case "multi-V2":
              return ccc.jacocoGradleMultiModuleEnableV2;
          case "single-V1":
              return ccc.jacocoGradleSingleModuleEnable;
          case "single-V2":
              return ccc.jacocoGradleSingleModuleEnableV2;
          default:
              throw new Error("Invalid template version or module type.");
      }
  }
}
