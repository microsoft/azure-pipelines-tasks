/// <reference path="../../../definitions/Q.d.ts" />
/// <reference path="../../../definitions/string.d.ts" />
/// <reference path="../../../definitions/node.d.ts" />
/// <reference path="../../../definitions/vsts-task-lib.d.ts" />

import * as util from './utilities';
import * as tl from 'vsts-task-lib/task';
import * as ccc from './codecoverageconstants';
import {CodeCoverageEnabler} from './codecoverageenabler';
import * as str from 'string';

abstract class CoberturaCodeCoverageEnabler extends CodeCoverageEnabler {
    protected applyCoberturaFilterPattern(filter: string): string[] {
        let coberturaFilter = [];
        let _this = this;

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

export class CoberturaMavenCodeCoverageEnabler extends CoberturaCodeCoverageEnabler {
    //-----------------------------------------------------
    // Enable code coverage for Cobertura Maven Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    //-----------------------------------------------------    
    public enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean> {
        let _this = this;

        let buildFile = ccProps['buildFile'];
        let classFilter = ccProps['classFilter'];
        let reportDir = ccProps['reportDir'];

        let filter = _this.extractFilters(classFilter);
        let cobExclude = _this.applyCoberturaFilterPattern(filter.excludeFilter);
        let cobInclude = _this.applyCoberturaFilterPattern(filter.includeFilter);
        let isMultiModule = false;
        let codeCoveragePluginData = ccc.coberturaMavenEnable(cobInclude.join(","), cobExclude.join(","), String(isMultiModule));

        return util.readXmlFileAsJson(buildFile).
            then(function (pomJson) {
                return _this.addCodeCoveragePluginData(pomJson, codeCoveragePluginData).thenResolve(true);
            });
    }

    private addCodeCoverageNodes(buildJsonContent: any, ccContent: any): Q.Promise<any> {
        let _this = this;
        let pluginsNode = null;
        let isMultiModule = false;
        let defer = Q.defer<boolean>();

        if (!buildJsonContent.project.build) {
            tl.debug("Build tag is not present");
            buildJsonContent.project.build = {};
        }

        if (!buildJsonContent.project.build || typeof buildJsonContent.project.build === 'string') {
            buildJsonContent.project.build = {};
        }

        if (buildJsonContent.project.build.pluginManagement) {
            if (typeof buildJsonContent.project.build.pluginManagement === 'string') {
                buildJsonContent.project.build.pluginManagement = {};
            }
            pluginsNode = buildJsonContent.project.build.pluginManagement.plugins;
        }
        else {
            if (!buildJsonContent.project.build.plugins || typeof buildJsonContent.project.build.plugins === 'string') {
                buildJsonContent.project.build.plugins = {};
            }
            pluginsNode = buildJsonContent.project.build.plugins;
        }

        util.addPropToJson(pluginsNode, 'plugin', ccContent);

        defer.resolve(buildJsonContent);
        return defer.promise;
    }

    private addCodeCoveragePluginData(pomJson: any, codeCoveragePluginData: any): Q.Promise<any> {
        let _this = this;
        return _this.addCodeCoverageNodes(pomJson, codeCoveragePluginData).
            then(function (content) {
                return util.writeJsonAsXmlFile(_this.buildFile, content);
            });
    }
}