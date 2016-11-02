
import * as util from "../utilities";
import * as tl from "vsts-task-lib/task";
import * as ccc from "../codecoverageconstants";
import * as cc from "../codecoverageenabler";
import * as str from "string";
import * as os from "os";
import * as Q from "q";
import * as path from "path";

export class JacocoAntCodeCoverageEnabler extends cc.JacocoCodeCoverageEnabler {

    reportDir: string;
    excludeFilter: string;
    includeFilter: string;
    sourceDirs: string;
    classDirs: string;
    reportBuildFile: string;
    excludeFilterExec: string;
    includeFilterExec: string;

    // -----------------------------------------------------
    // Enable code coverage for Jacoco Ant Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    // -----------------------------------------------------    
    public enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean> {
        let _this = this;

        tl.debug("Input parameters: " + JSON.stringify(ccProps));

        _this.buildFile = ccProps["buildfile"];
        _this.sourceDirs = ccProps["sourcedirectories"];
        _this.classDirs = ccProps["classfilesdirectories"];
        _this.reportDir = ccProps["reportdirectory"];
        _this.reportBuildFile = ccProps["reportbuildfile"];

        let classFilter = ccProps["classfilter"];
        let filter = _this.extractFilters(classFilter);
        _this.excludeFilterExec = filter.excludeFilter.startsWith(":") ? filter.excludeFilter.substr(1) : filter.excludeFilter;
        _this.includeFilterExec = filter.includeFilter.startsWith(":") ? filter.includeFilter.substr(1) : filter.includeFilter;
        _this.excludeFilter = _this.applyFilterPattern(filter.excludeFilter).join(",");
        _this.includeFilter = _this.applyFilterPattern(filter.includeFilter).join(",");

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

    protected getSourceFilter(): string {
        let srcData = "";
        let srcDirs = this.sourceDirs === null ? "" : this.sourceDirs;
        srcDirs.split(",").forEach(dir => {
            if (!str(dir).isEmpty()) {
                srcData += `<fileset dir="${dir}"/>`;
                srcData += os.EOL;
            }
        });
        if (str(srcData).isEmpty()) {
            srcData = `<fileset dir="."/>`;
            srcData += os.EOL;
        }
        return srcData;
    }

    protected getClassData(): string {
        let classData = "";
        this.classDirs.split(",").forEach(dir => {
            classData += `<fileset dir="${dir}" `;
            if (!util.isNullOrWhitespace(this.includeFilter)) {
                classData += `includes="${this.includeFilter}" `;
            }
            if (!util.isNullOrWhitespace(this.excludeFilter)) {
                classData += `excludes="${this.excludeFilter}" `;
            }
            classData +=  `/>`;
            classData += os.EOL;
        });
        if (str(classData).isEmpty()) {
            classData += `<fileset dir="."${this.includeFilter} ${this.excludeFilter} />`;
            classData += os.EOL;
        }
        return classData;
    }

    protected createReportFile(reportContent: string): Q.Promise<void> {
        let _this = this;
        return util.writeFile(_this.reportBuildFile, reportContent);
    }

    protected addCodeCoverageData(pomJson: any): Q.Promise<any[]> {
        let _this = this;
        if (!pomJson.project) {
            Q.reject(tl.loc("InvalidBuildFile"));
        }

        let sourceData = _this.getSourceFilter();
        let classData = _this.getClassData();
        let reportPluginData = ccc.jacocoAntReport(_this.reportDir, classData, sourceData);

        return Q.all([_this.addCodeCoveragePluginData(pomJson), _this.createReportFile(reportPluginData)]);
    }

    protected addCodeCoverageNodes(buildJsonContent: any): Q.Promise<any> {
        let _this = this;

        if (!buildJsonContent.project.target) {
            tl.debug("Build tag is not present");
            return Q.reject(tl.loc("InvalidBuildFile"));
        }

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

        return Q.resolve(buildJsonContent);
    }

    protected enableForking(targetNode: any) {
        let _this = this;
        let testNodes = ["junit", "java", "testng", "batchtest"];
        let coverageNode = ccc.jacocoAntCoverageEnable(_this.reportDir);

        if (!str(_this.includeFilter).isEmpty()) {
            coverageNode.$.includes = _this.includeFilterExec;
        }
        if (!str(_this.excludeFilter).isEmpty()) {
            coverageNode.$.excludes = _this.excludeFilterExec;
        }

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
            _this.enableForkOnTestNodes(targetNode[tn], true);
            coverageNode[tn] = targetNode[tn];
            delete targetNode[tn];
            targetNode["jacoco:coverage"] = coverageNode;
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
        return _this.addCodeCoverageNodes(pomJson)
            .then(function (content) {
                return util.writeJsonAsXmlFile(_this.buildFile, content);
            });
    }
}
