
import * as util from "../utilities";
import * as tl from 'azure-pipelines-task-lib/task';
import * as ccc from "../codecoverageconstants";
import * as cc from "../codecoverageenabler";
import * as Q from "q";
import * as path from "path";

tl.setResourcePath(path.join(path.dirname(__dirname), 'module.json'), true);

export class CoberturaMavenCodeCoverageEnabler extends cc.CoberturaCodeCoverageEnabler {

    protected includeFilter: string;
    protected excludeFilter: string;
    // -----------------------------------------------------
    // Enable code coverage for Cobertura Maven Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    // -----------------------------------------------------
    public enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean> {
        let _this = this;

        tl.debug("Input parameters: " + JSON.stringify(ccProps));

        _this.buildFile = ccProps["buildfile"];
        let classFilter = ccProps["classfilter"];

        let filter = _this.extractFilters(classFilter);
        _this.excludeFilter = _this.applyFilterPattern(filter.excludeFilter).join(",");
        _this.includeFilter = _this.applyFilterPattern(filter.includeFilter).join(",");

        return util.readXmlFileAsJson(_this.buildFile)
            .then(function (resp) {
                tl.debug("Read XML: " + resp);
                return _this.addCodeCoveragePluginData(resp);
            })
            .thenResolve(true);
    }

    protected applyFilterPattern(filter: string): string[] {
        let ccfilter = [];

        if (!util.isNullOrWhitespace(filter)) {
            util.trimToEmptyString(filter).replace(/\./g, "/").split(":").forEach(exFilter => {
                if (exFilter) {
                    ccfilter.push(exFilter.endsWith("*") ? (exFilter + "/**") : (exFilter + ".class"));
                }
            });
        }

        tl.debug("Applying the filter pattern: " + filter + " op: " + ccfilter);
        return ccfilter;
    }

    protected addCodeCoverageNodes(buildJsonContent: any): Q.Promise<any> {
        let _this = this;
        let isMultiModule = false;

        if (!buildJsonContent.project) {
            return Q.reject(tl.loc("InvalidBuildFile"));
        }

        if (buildJsonContent.project.modules) {
            tl.debug("Multimodule project detected");
            isMultiModule = true;
        }

        if (!buildJsonContent.project.build) {
            tl.debug("Build tag is not present");
            buildJsonContent.project.build = {};
        }

        let buildNode = _this.getBuildDataNode(buildJsonContent);
        let pluginsNode = _this.getPluginDataNode(buildNode);
        let reportPluginsNode = _this.getReportingPluginNode(buildJsonContent.project.reporting);
        let ccPluginData = ccc.coberturaMavenEnable(_this.includeFilter, _this.excludeFilter, String(isMultiModule));
        let reportContent = ccc.coberturaMavenReport();

        return Q.allSettled([ccPluginData, reportContent])
            .then(function (resp) {
                util.addPropToJson(pluginsNode, "plugin", resp[0].value.plugin);
                util.addPropToJson(reportPluginsNode, "plugin", resp[1].value.plugin);
                tl.debug("Final buildContent: " + buildJsonContent);
                return Q.resolve(buildJsonContent);
            });
    }

    private getBuildDataNode(buildJsonContent: any): any {
        let buildNode = null;
        if (!buildJsonContent.project.build || typeof buildJsonContent.project.build === "string") {
            buildNode = {};
            buildJsonContent.project.build = buildNode;
        }

        if (buildJsonContent.project.build instanceof Array) {
            if (typeof buildJsonContent.project.build[0] === "string") {
                buildNode = {};
                buildJsonContent.project.build[0] = buildNode;
            } else {
                buildNode = buildJsonContent.project.build[0];
            }
        }
        return buildNode;
    }

    private getPluginDataNode(buildNode: any): any {
        let pluginsNode = {};

        /* Always look for plugins node first */
        if (buildNode.plugins) {
            if (typeof buildNode.plugins === "string") {
                buildNode.plugins = {};
            }
            if (buildNode.plugins instanceof Array) {
                if (typeof buildNode.plugins[0] === "string") {
                    pluginsNode = {};
                    buildNode.plugins[0] = pluginsNode;
                } else {
                    pluginsNode = buildNode.plugins[0];
                }
            } else {
                pluginsNode = buildNode.plugins;
            }
        } else {
            buildNode.plugins = {};
            pluginsNode = buildNode.plugins;
        }
        return pluginsNode;
    }

    private getReportingPluginNode(reportNode: any): any {
        let pluginsNode = null;
        if (!reportNode || typeof reportNode === "string") {
            reportNode = {};
        }

        if (reportNode instanceof Array) {
            pluginsNode = reportNode[0].plugins;
        } else {
            pluginsNode = reportNode.plugins;
        }

        return pluginsNode;
    }

    protected addCodeCoveragePluginData(pomJson: any): Q.Promise<void> {
        let _this = this;
        tl.debug("Adding coverage plugin data");
        return _this.addCodeCoverageNodes(pomJson)
            .then(function (buildContent) {
                return util.writeJsonAsXmlFile(_this.buildFile, buildContent);
            });
    }
}
