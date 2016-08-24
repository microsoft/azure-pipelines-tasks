/// <reference path="../../../definitions/Q.d.ts" />
/// <reference path="../../../definitions/string.d.ts" />
/// <reference path="../../../definitions/node.d.ts" />
/// <reference path="../../../definitions/vsts-task-lib.d.ts" />

import * as util from './utilities';
import * as tl from 'vsts-task-lib/task';
import * as ccc from './codecoverageconstants';
import {CodeCoverageEnabler} from './codecoverageenabler';
import * as str from 'string';
import * as path from 'path';
import * as os from 'os';

abstract class JacocoCodeCoverageEnabler extends CodeCoverageEnabler {
    protected applyJacocoFilterPattern(filter: string): string[] {
        let jacocoFilter = [];
        let _this = this;

        if (!util.isNullOrWhitespace(filter)) {
            str(util.trimToEmptyString(filter)).replaceAll(".", "/").s.split(":").forEach(exFilter => {
                if (exFilter) {
                    jacocoFilter.push(str(exFilter).endsWith("*") ? ("'" + exFilter + "/**'") : ("'" + exFilter + ".class'"));
                }
            });
        }

        return jacocoFilter;
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
}

export class JacocoGradleCodeCoverageEnabler extends JacocoCodeCoverageEnabler {
    //-----------------------------------------------------
    // Enable code coverage for Jacoco Gradle Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    //-----------------------------------------------------    
    public enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean> {
        let defer = Q.defer<boolean>();
        let _this = this;

        _this.buildFile = ccProps['buildFile'];
        let classFilter = ccProps['classFilter'];
        let isMultiModule = ccProps['isMultiModule'];
        let classFileDirs = ccProps['classFileDirs'];
        let reportDir = ccProps['reportDir'];
        let codeCoveragePluginData = null;

        let filter = _this.extractFilters(classFilter);
        let jacocoExclude = _this.applyJacocoFilterPattern(filter.excludeFilter);
        let jacocoInclude = _this.applyJacocoFilterPattern(filter.includeFilter);

        if (isMultiModule) {
            codeCoveragePluginData = ccc.jacocoGradleMultiModuleEnable(jacocoExclude.join(","), jacocoInclude.join(","), classFileDirs, reportDir);
        } else {
            codeCoveragePluginData = ccc.jacocoGradleSingleModuleEnable(jacocoExclude.join(","), jacocoInclude.join(","), classFileDirs, reportDir);
        }

        if (codeCoveragePluginData) {
            tl.debug("Code Coverage data will be appeneded to build file: " + this.buildFile);
            util.appendTextToFileSync(this.buildFile, codeCoveragePluginData);
            tl.debug("Appended code coverage data");

            defer.resolve(true);
        } else {
            tl.warning("Unable to append code coverage data");
            defer.reject(false);
        }

        return defer.promise;
    }
}

export class JacocoMavenCodeCoverageEnabler extends JacocoCodeCoverageEnabler {

    //-----------------------------------------------------
    // Enable code coverage for Jacoco Maven Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    //-----------------------------------------------------    
    public enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean> {
        let _this = this;

        _this.buildFile = ccProps['buildFile'];
        let classFilter = ccProps['classFilter'];
        let reportDir = ccProps['reportDir'];

        let filter = _this.extractFilters(classFilter);
        let jacocoExclude = _this.applyJacocoFilterPattern(filter.excludeFilter);
        let jacocoInclude = _this.applyJacocoFilterPattern(filter.includeFilter);
        let codeCoveragePluginData = ccc.jacocoMavenPluginEnable(jacocoInclude.join(","), jacocoExclude.join(","), path.join(reportDir, "jacoco.exec"), reportDir);

        return util.readXmlFileAsJson(this.buildFile).
            then(function (pomJson) {
                return _this.addCodeCoverageData(pomJson, codeCoveragePluginData, reportDir).thenResolve(true);
            });
    }

    private addCodeCoverageData(pomJson: any, codeCoveragePluginData: any, reportDir: string): Q.Promise<any[]> {
        let _this = this;
        if (!pomJson.project) {
            console.error("Invalid/Unsupported POM xml");
        }

        let isMultiModule = false;
        if (pomJson.project.modules) {
            console.log("Multimodule project detected");
            isMultiModule = true;
        }

        let promises = [_this.addCodeCoveragePluginData(pomJson, codeCoveragePluginData)];
        if (isMultiModule) {
            promises.push(_this.createMultiModuleReport("jacoco.exec", reportDir, "report.xml"));
        }

        return Q.all(promises);
    }

    private addCodeCoverageNodes(buildJsonContent: any, ccContent: any): Q.Promise<any> {
        let _this = this;
        let pluginsNode = null;
        let isMultiModule = false;
        let defer = Q.defer<boolean>();

        if (!buildJsonContent.project.build) {
            tl.debug("Build tag is not present");
            buildJsonContent.project.build = {};
        }

        if (!buildJsonContent.project.build || typeof buildJsonContent.project.build === 'string') {
            buildJsonContent.project.build = {};
        }

        if (buildJsonContent.project.build.pluginManagement) {
            if (typeof buildJsonContent.project.build.pluginManagement === 'string') {
                buildJsonContent.project.build.pluginManagement = {};
            }
            pluginsNode = buildJsonContent.project.build.pluginManagement.plugins;
        }
        else {
            if (!buildJsonContent.project.build.plugins || typeof buildJsonContent.project.build.plugins === 'string') {
                buildJsonContent.project.build.plugins = {};
            }
            pluginsNode = buildJsonContent.project.build.plugins;
        }

        util.addPropToJson(pluginsNode, 'plugin', ccContent);

        defer.resolve(buildJsonContent);
        return defer.promise;
    }

    private createMultiModuleReport(jacocoExec: string, reportDir: string, reportFile: string): Q.Promise<any> {
        return util.writeFile(reportFile, ccc.jacocoMavenMultiModuleReport(jacocoExec, reportDir));
    }

    private addCodeCoveragePluginData(pomJson: any, codeCoveragePluginData: any): Q.Promise<any> {
        let _this = this;
        return _this.addCodeCoverageNodes(pomJson, codeCoveragePluginData).
            then(function (content) {
                return util.writeJsonAsXmlFile(this.buildFile, content);
            });
    }
}

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