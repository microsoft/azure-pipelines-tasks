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

export class CoberturaAntCodeCoverageEnabler extends cc.CoberturaCodeCoverageEnabler {

    reportDir: string;

    // -----------------------------------------------------
    // Enable code coverage for Cobertura Maven Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    // -----------------------------------------------------    
    public enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean> {
        let _this = this;
        let defer = Q.defer<boolean>();

        _this.buildFile = ccProps["buildFile"];
        let classFilter = ccProps["classFilter"];
        let sourceDirs = ccProps["sourceDirs"];
        let classDirs = ccProps["classDirs"];
        _this.reportDir = ccProps["reportDir"];

        let filter = _this.extractFilters(classFilter);
        let cobExclude = _this.applyCoberturaFilterPattern(filter.excludeFilter);
        let cobInclude = _this.applyCoberturaFilterPattern(filter.includeFilter);
        let sourceData = _this.getSourceFilter(sourceDirs);
        let classData = _this.getClassData(classDirs, cobInclude.join(","), cobExclude.join(","));

        console.log("Before reading: " + _this.buildFile);

        return util.readXmlFileAsJson(_this.buildFile).
            then(function (resp) {
                return _this.addCodeCoverageData(resp);
            })
            .thenResolve(true);
    }

    protected getSourceFilter(sourceFileDirs: string): string {
        let srcData = "";
        sourceFileDirs.split(",").forEach(dir => {
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

    protected getClassData(classDirs: string, includeData: string, excludeData: string): string {
        let classData = "";
        classDirs.split(",").forEach(dir => {
            classData += `<fileset dir='${dir}'${includeData} ${excludeData} />`;
            classData += os.EOL;
        });
        if (str(classData).isEmpty()) {
            classData += `<fileset dir='.'${includeData} ${excludeData} />`;
            classData += os.EOL;
        }
        return classData;
    }

    protected createReportFile(reportFile: string, reportContent: string): Q.Promise<void> {
        return util.writeFile(reportFile, reportContent);
    }

    protected addCodeCoverageData(pomJson: any): Q.Promise<any[]> {
        let _this = this;

        if (!pomJson || !pomJson.project) {
            return Q.reject<any>("Invalid/Unsupported POM xml");
        }

        console.log("Parallel promies");
        console.log(JSON.stringify(_this));
        console.log(JSON.stringify(this));
        let reportPluginData = ccc.coberturaAntReport();
        return Q.all([this.addCodeCoverageNodes(pomJson), _this.createReportFile("report.xml", reportPluginData)]);
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
        return util.writeJsonAsXmlFile(_this.buildFile, buildJsonContent);
    }

    protected enableForking(targetNode: any) {
        let _this = this;
        let coverageNode = ccc.coberturaAntCoverageEnable();

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
        // TODO ANT Cobertura
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
}