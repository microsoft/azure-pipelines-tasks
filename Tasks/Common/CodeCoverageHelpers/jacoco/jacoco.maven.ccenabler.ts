..//// <reference path="../../../../definitions/Q.d.ts" />
/// <reference path="../../../../definitions/string.d.ts" />
/// <reference path="../../../../definitions/node.d.ts" />
/// <reference path="../../../../definitions/vsts-task-lib.d.ts" />

import * as util from '../utilities';
import * as tl from 'vsts-task-lib/task';
import * as ccc from '../codecoverageconstants';
import {CodeCoverageEnabler} from '../codecoverageenabler';
import * as str from 'string';
import * as path from 'path';
import * as os from 'os';

export class JacocoMavenCodeCoverageEnabler extends JacocoCodeCoverageEnabler {

    //-----------------------------------------------------
    // Enable code coverage for Jacoco Maven Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    //-----------------------------------------------------    
    public enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean> {
        let _this = this;

        _this.buildFile = ccProps['buildFile'];
        let classFilter = ccProps['classFilter'];
        let reportDir = ccProps['reportDir'];

        let filter = _this.extractFilters(classFilter);
        let jacocoExclude = _this.applyJacocoFilterPattern(filter.excludeFilter);
        let jacocoInclude = _this.applyJacocoFilterPattern(filter.includeFilter);
        let codeCoveragePluginData = ccc.jacocoMavenPluginEnable(jacocoInclude.join(","), jacocoExclude.join(","), path.join(reportDir, "jacoco.exec"), reportDir);

        return util.readXmlFileAsJson(this.buildFile).
            then(function (pomJson) {
                return _this.addCodeCoverageData(pomJson, codeCoveragePluginData, reportDir).thenResolve(true);
            });
    }

    private addCodeCoverageData(pomJson: any, codeCoveragePluginData: any, reportDir: string): Q.Promise<any[]> {
        let _this = this;
        if (!pomJson.project) {
            console.error("Invalid/Unsupported POM xml");
        }

        let isMultiModule = false;
        if (pomJson.project.modules) {
            console.log("Multimodule project detected");
            isMultiModule = true;
        }

        let promises = [_this.addCodeCoveragePluginData(pomJson, codeCoveragePluginData)];
        if (isMultiModule) {
            promises.push(_this.createMultiModuleReport("jacoco.exec", reportDir, "report.xml"));
        }

        return Q.all(promises);
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

    private createMultiModuleReport(jacocoExec: string, reportDir: string, reportFile: string): Q.Promise<any> {
        return util.writeFile(reportFile, ccc.jacocoMavenMultiModuleReport(jacocoExec, reportDir));
    }

    private addCodeCoveragePluginData(pomJson: any, codeCoveragePluginData: any): Q.Promise<any> {
        let _this = this;
        return _this.addCodeCoverageNodes(pomJson, codeCoveragePluginData).
            then(function (content) {
                return util.writeJsonAsXmlFile(this.buildFile, content);
            });
    }
}