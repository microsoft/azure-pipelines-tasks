import * as Q from "q";
import * as util from "../utilities";
import * as tl from 'azure-pipelines-task-lib/task';
import * as ccc from "../codecoverageconstants";
import * as cc from "../codecoverageenabler";
import * as path from "path";

tl.setResourcePath(path.join(path.dirname(__dirname), 'module.json'), true);

export class CoberturaAntCodeCoverageEnabler extends cc.CoberturaCodeCoverageEnabler {

    reportDir: string;
    reportbuildfile: string;
    classDirs: string;
    includeFilter: string;
    excludeFilter: string;
    sourceDirs: string;

    // -----------------------------------------------------
    // Enable code coverage for Cobertura Ant Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    // -----------------------------------------------------
    public enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean> {
        let _this = this;

        tl.debug("Input parameters: " + JSON.stringify(ccProps));

        _this.reportDir = "CCReport43F6D5EF";
        _this.reportbuildfile = "CCReportBuildA4D283EG.xml";
        _this.buildFile = ccProps["buildfile"];
        let classFilter = ccProps["classfilter"];
        let srcDirs = ccProps["sourcedirectories"];
        if (util.isNullOrWhitespace(srcDirs)) {
            srcDirs = ".";
        }
        _this.sourceDirs = srcDirs;
        _this.classDirs = ccProps["classfilesdirectories"];

        let filter = _this.extractFilters(classFilter);
        _this.excludeFilter = _this.applyFilterPattern(filter.excludeFilter).join(",");
        _this.includeFilter = _this.applyFilterPattern(filter.includeFilter).join(",");

        tl.debug("Reading the build file: " + _this.buildFile);

        let buildContent = util.readXmlFileAsDom(_this.buildFile);
        return _this.addCodeCoverageData(buildContent)
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

    protected getClassData(): string {
        let _this = this;
        let classData = "";
        let classDirs = _this.classDirs;

        if (util.isNullOrWhitespace(classDirs)) {
            classDirs = ".";
        }
        classDirs.split(",").forEach(cdir => {
            classData += classData + `
            <fileset dir="${cdir}" includes="${_this.includeFilter}" excludes="${_this.excludeFilter}" />
            `;
        });
        return classData;
    }

    protected createReportFile(reportContent: string): Q.Promise<void> {
        let _this = this;
        tl.debug("Creating the report file: " + _this.reportbuildfile);

        let reportFile = path.join(path.dirname(_this.buildFile), _this.reportbuildfile);
        return util.writeFile(reportFile, reportContent);
    }

    protected addCodeCoverageData(pomJson: CheerioStatic): Q.Promise<any[]> {
        let _this = this;

        if (!pomJson || !pomJson("project")) {
            return Q.reject<any>(tl.loc("InvalidBuildFile"));
        }

        let reportPluginData = ccc.coberturaAntReport(_this.sourceDirs, path.join(path.dirname(_this.buildFile), _this.reportDir));
        return Q.all([_this.addCodeCoverageNodes(pomJson), _this.createReportFile(reportPluginData)]);
    }

    protected addCodeCoverageNodes(buildJsonContent: CheerioStatic): Q.Promise<any> {
        let _this = this;

        if (!buildJsonContent("project").children("target")) {
            tl.debug("Target tasks are not present");
            return Q.reject(tl.loc("InvalidBuildFile"));
        }

        buildJsonContent("project").prepend(ccc.coberturaAntCoverageEnable());
        buildJsonContent("project").children("target").each(function (i, elem) {
            _this.enableForking(buildJsonContent, elem);
        });

        return util.writeFile(_this.buildFile, buildJsonContent.xml());
    }

    protected enableForking(buildJsonContent: CheerioStatic, targetNode: CheerioElement) {
        let _this = this;
        let testNodes = ["junit", "java", "testng", "batchtest"];
        let buildDir = path.dirname(_this.buildFile);
        let coberturaNode = ccc.coberturaAntProperties(path.join(buildDir, _this.reportDir), path.dirname(_this.buildFile));
        let classData = ccc.coberturaAntInstrumentedClasses(buildDir, path.join(buildDir, _this.reportDir), _this.getClassData());

        if (targetNode.children) {
            targetNode.children.forEach(n => {
                if (n.name && n.name === "javac") {
                    n.attribs["debug"] = "true";
                }
            });
        }

        testNodes.forEach(tn => {
            if (!targetNode.children) {
                return;
            }

            targetNode.children.forEach(node => {
                if (node.name && node.name === tn) {
                    _this.enableForkOnTestNodes(node);
                    buildJsonContent("project").children("target").children(tn).prepend(coberturaNode);
                    buildJsonContent("project").children("target").children(tn).append(ccc.coberturaAntClasspathRef());
                };
            });
            if (buildJsonContent("project").children("target").children(tn)
                    && (!buildJsonContent("project").children("target").children("cobertura-instrument")
                        || buildJsonContent("project").children("target").children("cobertura-instrument").length === 0)) {
                buildJsonContent("project").children("target").children(tn).before(classData);
            }
        });
    }

    protected enableForkOnTestNodes(testNode: CheerioElement) {
        testNode.attribs["forkmode"] = "once";
        testNode.attribs["fork"] = "true";
    }
}
