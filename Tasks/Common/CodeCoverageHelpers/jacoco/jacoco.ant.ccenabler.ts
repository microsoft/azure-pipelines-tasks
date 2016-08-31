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
        _this.buildFile = ccProps["buildFile"];
        _this.sourceDirs = ccProps["sourceDirs"];
        _this.classDirs = ccProps["classDirs"];
        _this.reportDir = ccProps["reportDir"];

        let classFilter = ccProps["classFilter"];
        let filter = _this.extractFilters(classFilter);
        _this.excludeFilter = _this.applyJacocoFilterPattern(filter.excludeFilter).join(",");
        _this.includeFilter = _this.applyJacocoFilterPattern(filter.includeFilter).join(",");

        return util.readXmlFileAsJson(_this.buildFile).
            then(function (resp) {
                _this.addCodeCoverageData(resp);
            })
            .thenResolve(true);
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

    protected createReportFile(reportFile: string, reportContent: string): Q.Promise<void> {
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

        return Q.all([_this.addCodeCoveragePluginData(pomJson), _this.createReportFile("report.xml", reportPluginData)]);
    }

    protected addCodeCoverageNodes(buildJsonContent: any): Q.Promise<any> {
        let _this = this;
        let pluginsNode = null;

        if (!buildJsonContent.project.target) {
            console.log("Build tag is not present");
            return Q.reject("Invalid build file");
        }

        if (!buildJsonContent.project.target || typeof buildJsonContent.project.target === "string") {
            buildJsonContent.project.target = {};
        }

        _this.enableForking(buildJsonContent.project.target);
        return Q.resolve(buildJsonContent);
    }

    protected enableForking(targetNode: any) {
        let _this = this;
        let coverageNode = ccc.jacocoAntCoverageEnable();

        if (targetNode.junit) {
            let node = targetNode.junit;
            coverageNode.junit = node;
            _this.enableForkOnTestNodes(coverageNode, true);
            targetNode.junit = undefined;
        }
        if (targetNode.java) {
            let node = targetNode.java;
            coverageNode.java = node;
            _this.enableForkOnTestNodes(coverageNode, false);
            targetNode.java = undefined;
        }
        if (targetNode.testng) {
            let node = targetNode.testng;
            coverageNode.testng = node;
            _this.enableForkOnTestNodes(coverageNode, false);
            targetNode.testng = undefined;
        }
        if (targetNode.batchtest) {
            let node = targetNode.batchtest;
            coverageNode.batchtest = node;
            _this.enableForkOnTestNodes(coverageNode, true);
            targetNode.batchtest = undefined;
        }
        // TODO check if none of them available
        targetNode["jacoco.coverage"] = coverageNode;
    }

    protected enableForkOnTestNodes(testNode: any, enableForkMode: boolean) {
        if (typeof testNode === "Array") {
            testNode.forEach(element => {
                if (enableForkMode) {
                    element.$.forkmode = "once";
                }
                element.$.fork = "true";
            });
        } else {
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