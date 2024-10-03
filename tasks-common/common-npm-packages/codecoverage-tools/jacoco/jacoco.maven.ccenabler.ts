
import * as util from "../utilities";
import * as tl from 'azure-pipelines-task-lib/task';
import * as ccc from "../codecoverageconstants";
import * as cc from "../codecoverageenabler";
import * as Q from "q";
import * as path from "path";

tl.setResourcePath(path.join(path.dirname(__dirname), 'module.json'), true);

interface IPomData {
    groupId: string;
    artifactId: string;
    version: string;
    packaging?: string;
    modules?: [string];
}

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
    public enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<string> {
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
            });
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

    protected addCodeCoverageData(pomJson: any): Q.Promise<string> {
        let _this = this;

        if (!pomJson.project) {
            Q.reject(tl.loc("InvalidBuildFile"));
        }

        let isMultiModule = false;
        const originalPom = JSON.parse(JSON.stringify(pomJson));
        if (pomJson.project.modules) {
            tl.debug("Multimodule project detected");
            isMultiModule = true;
        }

        let promises = [_this.addCodeCoveragePluginData(pomJson)];
        if (isMultiModule) {
            pomJson.project.modules[0].module.push(path.basename(_this.reportDir));

            promises.push(_this.createMultiModuleReport(originalPom));
        }

        return Q.all(promises)
            .then(() => {
                const jacocoDir = isMultiModule ?
                    "jacoco-aggregate" :
                    "jacoco";

                const dirName = isMultiModule ?
                    _this.reportDir :
                    path.dirname(_this.reportDir);

                return path.join(dirName, "target", "site", jacocoDir);
            });
    }

    protected addCodeCoverageNodes(buildJsonContent: any): Q.Promise<any> {
        let _this = this;

        let buildNode = _this.getBuildDataNode(buildJsonContent);
        let pluginsNode = _this.getPluginDataNode(buildNode);
        let ccContent = ccc.jacocoMavenPluginEnable(_this.includeFilter, _this.excludeFilter);
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

    private getParentPomData (pomJson: any): IPomData {
        const groupId: string = pomJson.project.groupId[0];
        const artifactId: string = pomJson.project.artifactId[0];
        const version: string = pomJson.project.version[0];
        const jsonModulesProperty = pomJson.project?.modules;
        const modules: [string] = jsonModulesProperty instanceof Array ?
            jsonModulesProperty[0].module :
            []

        return {
            groupId,
            artifactId,
            version,
            modules
        }
    }

    private formatParentData(data: IPomData) {
        return `
                <parent>
                    <groupId>${data.groupId}</groupId>
                    <artifactId>${data.artifactId}</artifactId>
                    <version>${data.version}</version>
                </parent>
                `;
    }

    private formatModulesData(modules: IPomData[]) {
        const dependencies = modules.reduce((acc, current) => {
            return `
                    ${acc}
                    <dependency>
                        <groupId>${current.groupId}</groupId>
                        <artifactId>${current.artifactId}</artifactId>
                        <version>${current.version}</version>
                        <type>${current.packaging}</type>
                    </dependency>
                    `
        }, '');

        return `<dependencies>
                    ${dependencies}
                </dependencies>`;
    }

    private getModulesData(data: IPomData) {
        const _this = this;

        return data.modules.map((moduleName) => {
            const modulePom = path.join(path.dirname(_this.reportDir), moduleName, 'pom.xml');

            return util.readXmlFileAsJson(modulePom)
                .then((content) => {
                    const jsonGroup = content.project?.groupId;
                    const jsonVersion = content.project?.version;
                    const jsonPackaging = content.project?.packaging;

                    return {
                        artifactId: content.project.artifactId[0],
                        groupId: (jsonGroup && jsonGroup[0]) || data.groupId,
                        version: (jsonVersion && jsonVersion[0]) || data.version,
                        packaging: (jsonPackaging && jsonPackaging[0]) || "jar"
                    };
                });
        });
    }

    protected createMultiModuleReport(pomJson: any): Q.Promise<any> {
        let _this = this;
        let srcDirs = _this.sourceDirs;
        let classDirs = _this.classDirs;
        let includeFilter = _this.includeFilter.join(",");
        let excludeFilter = _this.excludeFilter.join(",");
        const reportArtifactId = path.basename(_this.reportDir)
        const parentData = _this.getParentPomData(pomJson);

        if (util.isNullOrWhitespace(srcDirs)) {
            srcDirs = ".";
        }
        if (util.isNullOrWhitespace(classDirs)) {
            classDirs = ".";
        }

        return Q.all(_this.getModulesData(parentData))
            .then((modules) => {
                return util.writeFile(
                    _this.reportBuildFile,
                    ccc.jacocoMavenMultiModuleReport(
                        reportArtifactId,
                        srcDirs,
                        classDirs,
                        includeFilter,
                        excludeFilter,
                        parentData.groupId,
                        _this.formatParentData(parentData),
                        _this.formatModulesData(modules)
                    )
                )
            });
    }

    protected addCodeCoveragePluginData(pomJson: any): Q.Promise<any> {
        let _this = this;
        return _this.addCodeCoverageNodes(pomJson)
            .then(function (content) {
                return util.writeJsonAsXmlFile(_this.buildFile, content);
            });
    }
}
