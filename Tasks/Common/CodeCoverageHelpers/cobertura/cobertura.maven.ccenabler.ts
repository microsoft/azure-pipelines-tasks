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

export class CoberturaMavenCodeCoverageEnabler extends CoberturaCodeCoverageEnabler {
    //-----------------------------------------------------
    // Enable code coverage for Cobertura Maven Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    //-----------------------------------------------------    
    public enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean> {
        let _this = this;

        _this.buildFile = ccProps['buildFile'];
        let classFilter = ccProps['classFilter'];
        let reportDir = ccProps['reportDir'];

        let filter = _this.extractFilters(classFilter);
        let cobExclude = _this.applyCoberturaFilterPattern(filter.excludeFilter);
        let cobInclude = _this.applyCoberturaFilterPattern(filter.includeFilter);
        let isMultiModule = false;
        let codeCoveragePluginData = ccc.coberturaMavenEnable(cobInclude.join(","), cobExclude.join(","), String(isMultiModule));

        return util.readXmlFileAsJson(_this.buildFile).
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