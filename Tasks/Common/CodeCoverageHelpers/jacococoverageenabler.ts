/// <reference path="../../../definitions/Q.d.ts" />
/// <reference path="../../../definitions/string.d.ts" />
/// <reference path="../../../definitions/node.d.ts" />
/// <reference path="../../../definitions/vsts-task-lib.d.ts" />

import * as util from './utilities';
import * as tl from 'vsts-task-lib/task';
import * as ccc from './codecoverageconstants';
import {CodeCoverageEnabler} from './codecoverageenabler';
import * as str from 'string';

export class JacocoGradleCodeCoverageEnabler extends CodeCoverageEnabler {
    //-----------------------------------------------------
    // Enable code coverage for Jacoco Gradle Builds
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
        var jacocoExclude = _this.applyJacocoFilterPattern(filter.excludeFilter);
        var jacocoInclude = _this.applyJacocoFilterPattern(filter.includeFilter);

        if (isMultiModule) {
            codeCoveragePluginData = ccc.jacocoGradleMultiModuleEnable(jacocoExclude.join(","), jacocoInclude.join(","), classFileDirs, reportDir);
        } else {
            codeCoveragePluginData = ccc.jacocoGradleSingleModuleEnable(jacocoExclude.join(","), jacocoInclude.join(","), classFileDirs, reportDir);
        }

        if (codeCoveragePluginData) {
            tl.debug("Code Coverage data will be appeneded to build file: " + buildFile);
            util.appendTextToFileSync(buildFile, codeCoveragePluginData);
            tl.debug("Appended code coverage data");

            defer.resolve(true);
        } else {
            tl.warning("Unable to append code coverage data");
            defer.resolve(false);
        }

        return defer.promise;
    }

    private applyJacocoFilterPattern(filter: string): string[] {
        var jacocoFilter = [];
        var _this = this;

        if (!util.isNullOrWhitespace(filter)) {
            str(util.trimToEmptyString(filter)).replaceAll(".", "/").s.split(":").forEach(exFilter => {
                if (exFilter) {
                    jacocoFilter.push(str(exFilter).endsWith("*") ? ("'" + exFilter + "/**'") : ("'" + exFilter + ".class'"));
                }
            });
        }

        return jacocoFilter;
    }
}

export class JacocoMavenCodeCoverageEnabler extends CodeCoverageEnabler {
    //-----------------------------------------------------
    // Enable code coverage for Jacoco Maven Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    //-----------------------------------------------------    
    public enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean> {
        var defer = Q.defer<boolean>();


        defer.resolve(true);
        return defer.promise;
    }
}

export class JacocoAntCodeCoverageEnabler extends CodeCoverageEnabler {
    //-----------------------------------------------------
    // Enable code coverage for Jacoco Ant Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    //-----------------------------------------------------    
    public enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean> {
        var defer = Q.defer<boolean>();


        defer.resolve(true);
        return defer.promise;
    }
}