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

export class JacocoMavenCodeCoverageEnabler extends cc.JacocoCodeCoverageEnabler {

    excludeFilter: string[];
    includeFilter: string[];
    reportDir: string;
    sourceDirs: string;
    classDirs: string;

    // -----------------------------------------------------
    // Enable code coverage for Jacoco Maven Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    // -----------------------------------------------------    
    public enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean> {
        let _this = this;

        _this.buildFile = ccProps["buildfile"];
        _this.reportDir = ccProps["reportdirectory"];
        _this.sourceDirs = ccProps["sourcedirectories"];
        _this.classDirs = ccProps["classfilesdirectories"];

        let classFilter = ccProps["classfilter"];
        let filter = _this.extractFilters(classFilter);
        _this.excludeFilter = _this.applyFilterPattern(filter.excludeFilter);
        _this.includeFilter = _this.applyFilterPattern(filter.includeFilter);

        return util.readXmlFileAsJson(_this.buildFile)
            .then(function (resp) {
                _this.addCodeCoverageData(resp);
            })
            .thenResolve(true);
    }

    protected applyFilterPattern(filter: string): string[] {
        let ccfilter = [];
        let _this = this;

        if (!util.isNullOrWhitespace(filter)) {
            str(util.trimToEmptyString(filter)).replaceAll(".", "/").s.split(":").forEach(exFilter => {
                if (exFilter) {
                    ccfilter.push(str(exFilter).endsWith("*") ? ("**/" + exFilter + "/**") : ("**/" + exFilter + ".class"));
                }
            });
        }

        return ccfilter;
    }

    protected addCodeCoverageData(pomJson: any): Q.Promise<any[]> {
        let _this = this;

        if (!pomJson.project) {
            Q.reject("Invalid/Unsupported POM xml");
        }

        let isMultiModule = false;
        if (pomJson.project.modules) {
            console.log("Multimodule project detected");
            isMultiModule = true;
        }

        let promises = [_this.addCodeCoveragePluginData(pomJson)];
        if (isMultiModule) {
            promises.push(_this.createMultiModuleReport(_this.reportDir));
        }

        return Q.all(promises);
    }

    protected addCodeCoverageNodes(buildJsonContent: any): Q.Promise<any> {
        let _this = this;
        let isMultiModule = false;
        let pluginsNode = null;
        let buildNode = null;

        if (!buildJsonContent.project.build) {
            console.log("Build tag is not present");
            buildJsonContent.project.build = {};
        }

        if (!buildJsonContent.project.build || typeof buildJsonContent.project.build === "string") {
            buildJsonContent.project.build = {};
        }

        if (buildJsonContent.project.build instanceof Array) {
            buildNode = buildJsonContent.project.build[0];
        } else {
            buildNode = buildJsonContent.project.build;
        }

        if (buildNode.pluginManagement) {
            if (typeof buildJsonContent.project.build.pluginManagement === "string") {
                buildNode.pluginManagement = {};
            }
            if (buildNode.pluginManagement instanceof Array) {
                pluginsNode = buildNode.pluginManagement[0].plugins;
            } else {
                pluginsNode = buildNode.pluginManagement.plugins;
            }
        }
        else {
            if (!buildNode.plugins || typeof buildNode.plugins === "string") {
                buildNode.plugins = {};
            }
            pluginsNode = buildNode.plugins;
        }

        let ccContent = ccc.jacocoMavenPluginEnable(_this.includeFilter, _this.excludeFilter, _this.reportDir);
        util.addPropToJson(pluginsNode, "plugin", ccContent);
        return Q.resolve(buildJsonContent);
    }

    protected createMultiModuleReport(reportDir: string): Q.Promise<any> {
        let _this = this;
        let srcDirs = _this.sourceDirs;
        let classDirs = _this.classDirs;
        let includeFilter = _this.includeFilter.join(",");
        let excludeFilter = _this.excludeFilter.join(",");
        let reportFile = path.join(path.dirname(_this.buildFile), "report.xml");

        if (str(srcDirs).isEmpty()) {
            srcDirs = ".";
        }
        if (str(classDirs).isEmpty()) {
            classDirs = ".";
        }

        return util.writeFile(reportFile, ccc.jacocoMavenMultiModuleReport(reportDir, srcDirs, classDirs, includeFilter, excludeFilter));
    }

    protected addCodeCoveragePluginData(pomJson: any): Q.Promise<any> {
        let _this = this;
        return _this.addCodeCoverageNodes(pomJson).
            then(function (content) {
                return util.writeJsonAsXmlFile(_this.buildFile, content);
            });
    }
}