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

export class CoberturaMavenCodeCoverageEnabler extends cc.CoberturaCodeCoverageEnabler {

    protected includeFilter: string;
    protected excludeFilter: string;
    // -----------------------------------------------------
    // Enable code coverage for Cobertura Maven Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    // -----------------------------------------------------    
    public enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean> {
        let _this = this;

        _this.buildFile = ccProps["buildfile"];
        let classFilter = ccProps["classfilter"];
        let reportDir = ccProps["reportdirectory"];

        let filter = _this.extractFilters(classFilter);
        _this.excludeFilter = _this.applyFilterPattern(filter.excludeFilter).join(",");
        _this.includeFilter = _this.applyFilterPattern(filter.includeFilter).join(",");

        return util.readXmlFileAsJson(_this.buildFile)
            .then(function (resp) {
                console.log("Read XML: "+resp);
                return _this.addCodeCoveragePluginData(resp);
            })
            .thenResolve(true);
    }

    protected applyFilterPattern(filter: string): string[] {
        let ccfilter = [];
        let _this = this;

        if (!util.isNullOrWhitespace(filter)) {
            str(util.trimToEmptyString(filter)).replaceAll(".", "/").s.split(":").forEach(exFilter => {
                if (exFilter) {
                    ccfilter.push(str(exFilter).endsWith("*") ? (exFilter + "/**") : (exFilter + ".class"));
                }
            });
        }

        return ccfilter;
    }

    protected addCodeCoverageNodes(buildJsonContent: any): Q.Promise<any> {
        let _this = this;
        let pluginsNode = null;
        let isMultiModule = false;
        let buildNode = null;
        
        if (!buildJsonContent.project) {
            return Q.reject("Invalid build file");
        }

        if (buildJsonContent.project.modules) {
            console.log("Multimodule project detected");
            isMultiModule = true;
        }

        if (!buildJsonContent.project.build) {
            console.log("Build tag is not present");
            buildJsonContent.project.build = {};
        }

        if (!buildJsonContent.project.build || typeof buildJsonContent.project.build === "string") {
            buildNode = {};
            buildJsonContent.project.build = buildNode;
        }

        if (buildJsonContent.project.build instanceof Array) {
            if(typeof buildJsonContent.project.build[0] === 'string'){
                buildNode = {};
                buildJsonContent.project.build[0] = buildNode;
            }else{
                buildNode = buildJsonContent.project.build[0];
            }
        }

        if (buildNode.pluginManagement) {
            if (typeof buildNode.pluginManagement === "string") {
                buildNode.pluginManagement = {};
            }
            if (buildNode.pluginManagement instanceof Array) {
                pluginsNode = buildNode.pluginManagement[0].plugins;
            }
            else {
                pluginsNode = buildNode.pluginManagement.plugins;
            }
        }
        else {
            if (!buildNode.plugins || typeof buildNode.plugins === "string") {
                buildNode.plugins = {};
            }
            if (buildNode.plugins instanceof Array) {
                if(typeof buildNode.plugins[0] === 'string'){
                    pluginsNode = {};
                    buildNode.plugins[0] = pluginsNode;
                }
                else{
                    pluginsNode = buildNode.plugins[0];
                }
            }else{
                pluginsNode = buildNode.plugins;
            }
        }

        let ccPluginData = ccc.coberturaMavenEnable(_this.includeFilter, _this.excludeFilter, String(isMultiModule));
        let reportContent = ccc.coberturaMavenReport();

        return Q.allSettled([ccPluginData, reportContent])
            .then(function (resp) {
                util.addPropToJson(pluginsNode, "plugin", resp[0].value.plugin);
                util.addPropToJson(buildJsonContent.project, "reporting", resp[1].value);
                console.log("Final buildContent: "+buildJsonContent);
                return Q.resolve(buildJsonContent);
            });
    }

    protected addCodeCoveragePluginData(pomJson: any): Q.Promise<void> {
        let _this = this;
        console.log("Adding coverage plugin data");
        return _this.addCodeCoverageNodes(pomJson)
            .then(function (buildContent) {
                return util.writeJsonAsXmlFile(_this.buildFile, buildContent);
            });
    }
}