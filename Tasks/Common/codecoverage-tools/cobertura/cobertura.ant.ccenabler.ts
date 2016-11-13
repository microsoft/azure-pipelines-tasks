
import * as Q from "q";
import * as util from "../utilities";
import * as tl from "vsts-task-lib/task";
import * as ccc from "../codecoverageconstants";
import * as cc from "../codecoverageenabler";
import * as str from "string";
import * as path from "path";

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
        if (str(srcDirs).isEmpty()) {
            srcDirs = ".";
        }
        _this.sourceDirs = srcDirs;
        _this.classDirs = ccProps["classfilesdirectories"];

        let filter = _this.extractFilters(classFilter);
        _this.excludeFilter = _this.applyFilterPattern(filter.excludeFilter).join(",");
        _this.includeFilter = _this.applyFilterPattern(filter.includeFilter).join(",");

        tl.debug("Reading the build file: " + _this.buildFile);

        return util.readXmlFileAsJson(_this.buildFile)
            .then(function (resp) {
                return _this.addCodeCoverageData(resp);
            })
            .thenResolve(true);
    }

    protected applyFilterPattern(filter: string): string[] {
        let ccfilter = [];

        if (!util.isNullOrWhitespace(filter)) {
            str(util.trimToEmptyString(filter)).replaceAll(".", "/").s.split(":").forEach(exFilter => {
                if (exFilter) {
                    ccfilter.push(str(exFilter).endsWith("*") ? ("**/" + exFilter + "/**") : ("**/" + exFilter + ".class"));
                }
            });
        }

        tl.debug("Applying the filter pattern: " + filter + " op: " + ccfilter);
        return ccfilter;
    }

    protected getClassData(): any {
        let _this = this;
        let fileset = [];
        let classDirs = _this.classDirs;

        if (str(classDirs).isEmpty()) {
            classDirs = ".";
        }
        classDirs.split(",").forEach(cdir => {
            let filter = {
                $: {
                    dir: cdir,
                    includes: _this.includeFilter,
                    excludes: _this.excludeFilter
                }
            };
            fileset.push(filter);
        });
        return fileset;
    }

    protected createReportFile(reportContent: string): Q.Promise<void> {
        let _this = this;
        tl.debug("Creating the report file: " + _this.reportbuildfile);

        let reportFile = path.join(path.dirname(_this.buildFile), _this.reportbuildfile);
        return util.writeFile(reportFile, reportContent);
    }

    protected addCodeCoverageData(pomJson: any): Q.Promise<any[]> {
        let _this = this;

        if (!pomJson || !pomJson.project) {
            return Q.reject<any>(tl.loc("InvalidBuildFile"));
        }

        let reportPluginData = ccc.coberturaAntReport(_this.sourceDirs, path.join(path.dirname(_this.buildFile), _this.reportDir));
        return Q.all([_this.addCodeCoverageNodes(pomJson), _this.createReportFile(reportPluginData)]);
    }

    protected addCodeCoverageNodes(buildJsonContent: any): Q.Promise<any> {
        let _this = this;

        if (!buildJsonContent.project.target) {
            tl.debug("Build tag is not present");
            return Q.reject(tl.loc("InvalidBuildFile"));
        }

        ccc.coberturaAntCoverageEnable(buildJsonContent.project);

        if (!buildJsonContent.project.target || typeof buildJsonContent.project.target === "string") {
            buildJsonContent.project.target = {};
        }

        if (buildJsonContent.project.target instanceof Array) {
            buildJsonContent.project.target.forEach(element => {
                _this.enableForking(element);
            });
        } else {
            _this.enableForking(buildJsonContent.project.target);
        }
        return util.writeJsonAsXmlFile(_this.buildFile, buildJsonContent);
    }

    protected enableForking(targetNode: any) {
        let _this = this;
        let coberturaNode = ccc.coberturaAntInstrumentedClasses(path.dirname(_this.buildFile), _this.reportDir);
        coberturaNode.fileset = _this.getClassData();
        let testNodes = ["junit", "java", "testng", "batchtest"];

        if (targetNode.javac) {
            if (targetNode.javac instanceof Array) {
                targetNode.javac.forEach(jn => {
                    jn.$.debug = "true";
                });
            }
        }

        testNodes.forEach(tn => {
            if (!targetNode[tn]) {
                return;
            }

            let node = targetNode[tn];
            _this.enableForkOnTestNodes(node, true);
            if (node instanceof Array) {
                node.forEach(n => {
                    ccc.coberturaAntProperties(n, _this.reportDir, path.dirname(_this.buildFile));
                });
            } else {
                ccc.coberturaAntProperties(node, _this.reportDir, path.dirname(_this.buildFile));
            }

            targetNode["cobertura-instrument"] = coberturaNode;
        });
    }

    protected enableForkOnTestNodes(testNode: any, enableForkMode: boolean) {
        if (testNode instanceof Array) {
            testNode.forEach(element => {
                if (!element.$) {
                    element.$ = {};
                }
                if (enableForkMode) {
                    element.$.forkmode = "once";
                }
                element.$.fork = "true";

            });
        } else {
            if (!testNode.$) {
                testNode.$ = {};
            }
            if (enableForkMode) {
                testNode.$.forkmode = "once";
            }
            testNode.$.fork = "true";
        }
    }
}
