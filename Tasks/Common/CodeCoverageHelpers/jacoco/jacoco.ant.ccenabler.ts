/// <reference path="../../../../definitions/Q.d.ts" />
/// <reference path="../../../../definitions/string.d.ts" />
/// <reference path="../../../../definitions/node.d.ts" />
/// <reference path="../../../../definitions/vsts-task-lib.d.ts" />

import * as util from '../utilities';
import * as tl from 'vsts-task-lib/task';
import * as ccc from '../codecoverageconstants';
import {CodeCoverageEnabler} from '../codecoverageenabler';
import * as str from 'string';
import * as path from 'path';
import * as os from 'os';

export class JacocoAntCodeCoverageEnabler extends JacocoCodeCoverageEnabler {
    //-----------------------------------------------------
    // Enable code coverage for Jacoco Ant Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    //-----------------------------------------------------    
    public enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean> {
        let _this = this;
        let defer = Q.defer<boolean>();
        _this.buildFile = ccProps['buildFile'];
        let classFilter = ccProps['classFilter'];
        let sourceDirs = ccProps['sourceDirs'];
        let classDirs = ccProps['classDirs'];
        let reportDir = ccProps['reportDir'];

        let filter = _this.extractFilters(classFilter);
        let jacocoExclude = _this.applyJacocoFilterPattern(filter.excludeFilter);
        let jacocoInclude = _this.applyJacocoFilterPattern(filter.includeFilter);
        let sourceData = _this.getSourceFilter(sourceDirs);
        let classData = _this.getClassData(classDirs, jacocoInclude.join(","), jacocoExclude.join(","));

        let reportPluginData = ccc.jacocoAntReport('jacoco.exec', reportDir, classData, sourceData);

        util.readXmlFileAsJson(this.buildFile).
            then(function (pomJson) {
                return _this.addCodeCoverageData(pomJson, reportPluginData, reportDir).thenResolve(true);
            });


        defer.resolve(true);
        return defer.promise;
    }

    protected getSourceFilter(sourceFileDirs: string): string {
        let srcData = "";
        sourceFileDirs.split(",").forEach(dir => {
            if (!str(dir).isEmpty()) {
                srcData += `<fileset dir='${dir}'/>`
                srcData += os.EOL;
            }
        });
        if (str(srcData).isEmpty()) {
            srcData = `<fileset dir='.'/>`
            srcData += os.EOL;
        }
        return srcData;
    }

    private getClassData(classDirs: string, includeData: string, excludeData: string): string {
        let classData = "";
        classDirs.split(",").forEach(dir => {
            classData += `<fileset dir='${dir}'${includeData} ${excludeData} />`;
            classData += os.EOL;
        })
        if (str(classData).isEmpty()) {
            classData += `<fileset dir='.'${includeData} ${excludeData} />`;
            classData += os.EOL;
        }
        return classData;
    }

    private createReportFile(reportFile: string, reportContent: string): Q.Promise<void> {
        return util.writeFile(reportFile, reportContent);
    }

    private addCodeCoverageData(pomJson: any, reportPluginData: any, reportDir: string): Q.Promise<any[]> {
        let _this = this;
        if (!pomJson.project) {
            console.error("Invalid/Unsupported POM xml");
        }

        return Q.all([_this.addCodeCoverageNodes(pomJson), _this.createReportFile("report.xml", reportPluginData)]);
    }

    private addCodeCoverageNodes(buildJsonContent: any): Q.Promise<any> {
        let _this = this;
        let pluginsNode = null;

        if (!buildJsonContent.project.target) {
            tl.debug("Build tag is not present");
            return Q.reject("Invalid build file");
        }

        if (!buildJsonContent.project.target || typeof buildJsonContent.project.target === 'string') {
            buildJsonContent.project.target = {};
        }
        _this.enableForking(buildJsonContent.project.target);
        return Q.resolve(buildJsonContent);
    }

    private enableForking(targetNode: any) {
        let _this = this;
        let coverageNode = ccc.jacocoAntCoverageEnable();

        if (targetNode.junit) {
            let node = targetNode.junit;
            coverageNode.junit = node;
            _this.enableForkOnTestNodes(coverageNode, true);
            targetNode.junit = undefined
        }
        if (targetNode.java) {
            let node = targetNode.java;
            coverageNode.java = node;
            _this.enableForkOnTestNodes(coverageNode, false);
            targetNode.java = undefined
        }
        if (targetNode.testng) {
            let node = targetNode.testng;
            coverageNode.testng = node;
            _this.enableForkOnTestNodes(coverageNode, false);
            targetNode.testng = undefined
        }
        if (targetNode.batchtest) {
            let node = targetNode.batchtest;
            coverageNode.batchtest = node;
            _this.enableForkOnTestNodes(coverageNode, true);
            targetNode.batchtest = undefined
        }
        //TODO check if none of them available
        targetNode["jacoco.coverage"] = coverageNode;
    }

    private enableForkOnTestNodes(testNode: any, enableForkMode: boolean) {
        if (typeof testNode === 'Array') {
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