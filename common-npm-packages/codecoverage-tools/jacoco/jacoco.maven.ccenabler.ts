
import * as util from "../utilities";
import * as tl from 'azure-pipelines-task-lib/task';
import * as ccc from "../codecoverageconstants";
import * as cc from "../codecoverageenabler";
import * as Q from "q";
import * as path from "path";

tl.setResourcePath(path.join(path.dirname(__dirname), 'module.json'), true);

export class JacocoMavenCodeCoverageEnabler extends cc.JacocoCodeCoverageEnabler {

    excludeFilter: string[];
    includeFilter: string[];
    reportDir: string;
    sourceDirs: string;
    classDirs: string;
    reportBuildFile: string;

    // -----------------------------------------------------
    // Enable code coverage for Jacoco Maven Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    // -----------------------------------------------------
    public enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean> {
        let _this = this;

        tl.debug("Input parameters: " + JSON.stringify(ccProps));

        _this.buildFile = ccProps["buildfile"];
        _this.reportDir = ccProps["reportdirectory"];
        _this.sourceDirs = ccProps["sourcedirectories"];
        _this.classDirs = ccProps["classfilesdirectories"];
        _this.reportBuildFile = ccProps["reportbuildfile"];

        let classFilter = ccProps["classfilter"];
        let filter = _this.extractFilters(classFilter);
        _this.excludeFilter = _this.applyFilterPattern(filter.excludeFilter);
        _this.includeFilter = _this.applyFilterPattern(filter.includeFilter);

        return util.readXmlFileAsJson(_this.buildFile)
            .then(function (resp) {
                return _this.addCodeCoverageData(resp);
            })
            .thenResolve(true);
    }

    protected applyFilterPattern(filter: string): string[] {
        let ccfilter = [];

        if (!util.isNullOrWhitespace(filter)) {
            util.trimToEmptyString(filter).replace(/\./g, "/").split(":").forEach(exFilter => {
                if (exFilter) {
                    ccfilter.push(exFilter.endsWith("*") ? ("**/" + exFilter + "/**") : ("**/" + exFilter + ".class"));
                }
            });
        }

        tl.debug("Applying the filter pattern: " + filter + " op: " + ccfilter);
        return ccfilter;
    }

    protected addCodeCoverageData(pomJson: any): Q.Promise<any[]> {
        let _this = this;

        if (!pomJson.project) {
            Q.reject(tl.loc("InvalidBuildFile"));
        }

        let isMultiModule = false;
        const originalPom = { ...pomJson };
        if (pomJson.project.modules) {
            tl.debug("Multimodule project detected");
            isMultiModule = true;
            pomJson.project.modules[0].module.push('CCReport43F6D5EF')
        }

        let promises = [_this.addCodeCoveragePluginData(pomJson)];
        if (isMultiModule) {
            promises.push(_this.createMultiModuleReport(_this.reportDir, originalPom));
        }

        return Q.all(promises);
    }

    protected addCodeCoverageNodes(buildJsonContent: any): Q.Promise<any> {
        let _this = this;

        let buildNode = _this.getBuildDataNode(buildJsonContent);
        let pluginsNode = _this.getPluginDataNode(buildNode);
        let ccContent = ccc.jacocoMavenPluginEnable(_this.includeFilter, _this.excludeFilter, _this.reportDir);
        util.addPropToJson(pluginsNode, "plugin", ccContent);
        return Q.resolve(buildJsonContent);
    }

    private getBuildDataNode(buildJsonContent: any): any {
        let buildNode = null;
        if (!buildJsonContent.project.build || typeof buildJsonContent.project.build === "string") {
            buildNode = {};
            buildJsonContent.project.build = buildNode;
        } else if (buildJsonContent.project.build instanceof Array) {
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

    private getParentData(pomJson: any): string {
        const groupId = pomJson.project.groupId[0];
        const artifactId = pomJson.project.artifactId[0];
        const version = pomJson.project.version[0];

        tl.debug('Parent 11122 ' + groupId + ' ' + artifactId + ' ' + version);
        return `<parent>
                    <groupId>${groupId}</groupId>
                    <artifactId>${artifactId}</artifactId>
                    <version>${version}</version>
                </parent>`;
    }

    private getModulesData(pomJson: any): string {
        const modules: [string] = pomJson.project.modules[0].module;

        const dependencies = modules.reduce((prev, current) =>
            `
            ${current}
            <dependency>
                <groupId>org.sonarqube</groupId>
                <artifactId>${prev}</artifactId>
                <version>\${project.version}</version>
            </dependency>
            `,
            ''
        )

        return `<dependencies>${dependencies}</dependencies>`;
    }

    protected createMultiModuleReport(reportDir: string, pomJson: any): Q.Promise<any> {
        let _this = this;
        let srcDirs = _this.sourceDirs;
        let classDirs = _this.classDirs;
        let includeFilter = _this.includeFilter.join(",");
        let excludeFilter = _this.excludeFilter.join(",");
        const parentData = _this.getParentData(pomJson);
        const modules = _this.getModulesData(pomJson);

        if (util.isNullOrWhitespace(srcDirs)) {
            srcDirs = ".";
        }
        if (util.isNullOrWhitespace(classDirs)) {
            classDirs = ".";
        }

        return util.writeFile(_this.reportBuildFile, ccc.jacocoMavenMultiModuleReport(reportDir, srcDirs, classDirs, includeFilter, excludeFilter, parentData, modules));
    }

    protected addCodeCoveragePluginData(pomJson: any): Q.Promise<any> {
        let _this = this;
        return _this.addCodeCoverageNodes(pomJson)
            .then(function (content) {
                return util.writeJsonAsXmlFile(_this.buildFile, content);
            });
    }
}
