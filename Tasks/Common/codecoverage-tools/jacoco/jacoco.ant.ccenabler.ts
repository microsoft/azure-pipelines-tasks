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

export class JacocoAntCodeCoverageEnabler extends cc.JacocoCodeCoverageEnabler {

    reportDir: string;
    excludeFilter: string;
    includeFilter: string;
    sourceDirs: string;
    classDirs: string;

    // -----------------------------------------------------
    // Enable code coverage for Jacoco Ant Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    // -----------------------------------------------------    
    public enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean> {
        let _this = this;
        let defer = Q.defer<boolean>();
        _this.buildFile = ccProps["buildfile"];
        _this.sourceDirs = ccProps["sourcedirectories"];
        _this.classDirs = ccProps["classfilesdirectories"];
        _this.reportDir = ccProps["reportdirectory"];

        let classFilter = ccProps["classfilter"];
        let filter = _this.extractFilters(classFilter);
        _this.excludeFilter = _this.applyFilterPattern(filter.excludeFilter).join(",");
        _this.includeFilter = _this.applyFilterPattern(filter.includeFilter).join(",");

        return util.readXmlFileAsJson(_this.buildFile).
            then(function (resp) {
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

    protected getSourceFilter(): string {
        let srcData = "";
        this.sourceDirs.split(",").forEach(dir => {
            if (!str(dir).isEmpty()) {
                srcData += `<fileset dir='${dir}'/>`;
                srcData += os.EOL;
            }
        });
        if (str(srcData).isEmpty()) {
            srcData = `<fileset dir='.'/>`;
            srcData += os.EOL;
        }
        return srcData;
    }

    protected getClassData(): string {
        let classData = "";
        this.classDirs.split(",").forEach(dir => {
            classData += `<fileset dir='${dir}'${this.includeFilter} ${this.excludeFilter} />`;
            classData += os.EOL;
        });
        if (str(classData).isEmpty()) {
            classData += `<fileset dir='.'${this.includeFilter} ${this.excludeFilter} />`;
            classData += os.EOL;
        }
        return classData;
    }

    protected createReportFile(reportContent: string): Q.Promise<void> {
        let _this = this;
        let reportFile = path.join(path.dirname(_this.buildFile), "report.xml");
        return util.writeFile(reportFile, reportContent);
    }

    protected addCodeCoverageData(pomJson: any): Q.Promise<any[]> {
        let _this = this;
        if (!pomJson.project) {
            console.error("Invalid/Unsupported POM xml");
        }

        let sourceData = _this.getSourceFilter();
        let classData = _this.getClassData();
        let reportPluginData = ccc.jacocoAntReport(_this.reportDir, classData, sourceData);

        return Q.all([_this.addCodeCoveragePluginData(pomJson), _this.createReportFile(reportPluginData)]);
    }

    protected addCodeCoverageNodes(buildJsonContent: any): Q.Promise<any> {
        let _this = this;
        let pluginsNode = null;
        let coverageNode = ccc.jacocoAntCoverageEnable();

        if (!buildJsonContent.project.target) {
            console.log("Build tag is not present");
            return Q.reject("Invalid build file");
        }

        if (!buildJsonContent.project.target || typeof buildJsonContent.project.target === "string") {
            buildJsonContent.project.target = {};
        }

        buildJsonContent.project.target["jacoco.coverage"] = coverageNode;

        if (buildJsonContent.project.target instanceof Array) {
            buildJsonContent.project.target.forEach(element => {
                _this.enableForking(element);
            });
        }
        else {
            _this.enableForking(buildJsonContent.project.target);
        }

        return Q.resolve(buildJsonContent);
    }

    protected enableForking(targetNode: any) {
        let _this = this;
        let testNodes = ["junit", "java", "testng", "batchtest"];

        testNodes.forEach(tn => {
            if (!targetNode[tn]) {
                return;
            }
            _this.enableForkOnTestNodes(targetNode[tn], true);
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

    protected addCodeCoveragePluginData(pomJson: any): Q.Promise<any> {
        let _this = this;
        return _this.addCodeCoverageNodes(pomJson).
            then(function (content) {
                return util.writeJsonAsXmlFile(this.buildFile, content);
            });
    }
}