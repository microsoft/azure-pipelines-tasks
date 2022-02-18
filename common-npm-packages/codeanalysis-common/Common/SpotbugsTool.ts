import { BuildOutput, BuildEngine } from './BuildOutput';
import { ModuleOutput } from './ModuleOutput';
import { ToolRunner } from 'azure-pipelines-task-lib/toolrunner';
import { BaseTool } from './BaseTool';

import * as util from "../utilities";

import path = require('path');
import fs = require('fs');
import * as xml2js from "xml2js";

import * as tl from 'azure-pipelines-task-lib/task';

const defaultPluginVersion: string = '4.7.0';

/**
 * An object that is able to configure the build to run SpotBugs and identify and parse SpotBugs reports
 *
 * @export
 * @class PmdReportParser
 * @implements {IAnalysisToolReportParser}
 */
export class SpotbugsTool extends BaseTool {
    constructor(buildOutput: BuildOutput, boolInputName: string) {
        super('SpotBugs', buildOutput, boolInputName);
    }

    /**
     * Configures the provided ToolRunner instance with arguments which will invoke the tool represented by this class.
     * @param toolRunner
     * @returns {ToolRunner} ToolRunner instance with arguments applied
     */
    public configureBuild(toolRunner: ToolRunner): ToolRunner {
        if (this.isEnabled()) {
            console.log(tl.loc('codeAnalysis_ToolIsEnabled'), this.toolName);

            tl.debug('Build engine is: ' + this.buildOutput.buildEngine)

            switch (this.buildOutput.buildEngine) {
                case BuildEngine.Maven:
                    tl.debug('Maven spotbugs tool')

                    this.enablePluginForMaven();
                    toolRunner.arg(['spotbugs:spotbugs']);

                    break;
                case BuildEngine.Gradle:
                    const specifyPluginVersion = tl.getInput('spotbugsGradlePluginVersionChoice') === 'specify';
                    if (specifyPluginVersion) {
                        // #1: Inject custom script to the Gradle build, triggering a Spotbugs run
                        // Add a custom initialisation script to the Gradle run that will apply the Spotbugs plugin and task
                        // Set the Spotbugs Gradle plugin version in the script
                        const pluginVersion: string = this.getSpotBugsGradlePluginVersion();
                        let initScriptPath: string = path.join(__dirname, '..', 'spotbugs.gradle');
                        let scriptContents: string = fs.readFileSync(initScriptPath, 'utf8');
                        scriptContents = scriptContents.replace('SPOTBUGS_GRADLE_PLUGIN_VERSION', pluginVersion);
                        tl.writeFile(initScriptPath, scriptContents);
                        // Specify that the build should run the init script
                        toolRunner.arg(['-I', initScriptPath]);
                        toolRunner.arg(['check']);
                    }
                    break;
                default:
                    throw new Error('Unknown build engine')
                    break;
            }

        }
        return toolRunner;
    }

    protected async enablePluginForMaven() {
        const specifyPluginVersion = tl.getInput('spotbugsMavenPluginVersionChoice') === 'specify';
        if (specifyPluginVersion) {
            const pluginVersion: string = this.getSpotBugsMavenPluginVersion();
            console.warn({ specifyPluginVersion, pluginVersion })
            // here needs to write a config of spotbugs plugin to pom.xml file
            // tl.writeFile(initScriptPath, scriptContents);
        }
        const _this = this;

        const mavenPOMFile: string = tl.getPathInput('mavenPOMFile', true, true);
        const buildRootPath = path.dirname(mavenPOMFile);
        const reportPOMFileName = "CCReportPomA4D283EG.xml";
        const reportPOMFile = path.join(buildRootPath, reportPOMFileName);
        const targetDirectory = path.join(buildRootPath, "target");

        tl.debug("Input parameters: " + JSON.stringify({
            mavenPOMFile, buildRootPath, reportPOMFileName,
            reportPOMFile,
            targetDirectory
        }));

        const pomJson = await util.readXmlFileAsJson(mavenPOMFile)
        tl.debug(`resp: ${JSON.stringify(pomJson)}`)

        const result = await _this.addSpotbugsData(pomJson)

        tl.debug(`result: ${result}`)

        // var classFilter: string = tl.getInput('classFilter');
        // var classFilesDirectories: string = tl.getInput('classFilesDirectories');
        // var sourceDirectories: string = tl.getInput('srcDirectories');
        // appending with small guid to keep it unique. Avoiding full guid to ensure no long path issues.

    }

    protected getSpotBugsGradlePluginVersion(): string {
        const userSpecifiedVersion = tl.getInput('spotbugsGradlePluginVersion');
        if (userSpecifiedVersion) {
            return userSpecifiedVersion.trim();
        }
        return defaultPluginVersion;
    }

    protected getSpotBugsMavenPluginVersion(): string {
        const userSpecifiedVersion = tl.getInput('spotbugsMavenPluginVersion');
        if (userSpecifiedVersion) {
            return userSpecifiedVersion.trim();
        }
        return '4.5.3';
    }

    /**
     * Implementers must specify where the XML reports are located
     */
    protected getBuildReportDir(output: ModuleOutput): string {
        return path.join(output.moduleRoot, 'reports', 'spotbugs');
    }

    /**
     * Report parser that extracts the number of affected files and the number of violations from a report
     *
     * @returns a tuple of [affected_file_count, violation_count]
     */
    protected parseXmlReport(xmlReport: string, moduleName: string): [number, number] {
        let jsonCounts: [number, number] = [0, 0];

        let reportContent: string = fs.readFileSync(xmlReport, 'utf-8');
        xml2js.parseString(reportContent, (err, data) => {
            jsonCounts = SpotbugsTool.parseJson(data);
            if (jsonCounts == null) {
                tl.debug(`[CA] Empty or unrecognized SpotBugs XML report ${xmlReport}`);
                return null;
            }

            let violationCount: number = jsonCounts[1];

            // No files with violations, return now that it has been marked for upload
            if (violationCount === 0) {
                tl.debug(`[CA] A SpotBugs report was found for module '${moduleName}' but it contains no violations`);
                return null;
            }

            tl.debug(`[CA] A SpotBugs report was found for for module '${moduleName}' containing ${violationCount} issues - ${xmlReport}`);
        });

        return jsonCounts;
    }

    /**
     * Extracts the number of affected files and the number of violations from a report JSON object
     * @param data JSON object to parse
     * @returns a tuple of [affected_file_count, violation_count]
     */
    private static parseJson(data: any): [number, number] {
        // If the file is not XML, or is not from SpotBugs, return immediately
        const classStats = data?.BugCollection?.FindBugsSummary[0]?.PackageStats[0]?.ClassStats;
        if (!classStats || !classStats.length) {
            return null;
        }

        let fileCount: number = 0;
        let violationCount: number = 0;

        // Extract violation and file count data from the sourceFile attribute of ClassStats
        let filesToViolations: Map<string, number> = new Map(); // Maps files -> number of violations
        classStats.forEach((classStats: any) => {
            // The below line takes the sourceFile attribute of the classStats tag - it looks like this in the XML
            // <ClassStats class="main.java.TestClassWithErrors" sourceFile="TestClassWithErrors.java" ... />
            let sourceFile: string = classStats.$.sourceFile;
            let newBugCount: number = Number(classStats.$.bugs);
            if (newBugCount > 0) {
                // If there was not already an entry, start at 0
                if (!filesToViolations.has(sourceFile)) {
                    filesToViolations.set(sourceFile, 0);
                }

                // Increment bug count
                let oldBugCount: number = filesToViolations.get(sourceFile);
                filesToViolations.set(sourceFile, oldBugCount + newBugCount);
            }
        });

        // Sum violations across all files for violationCount
        for (let violations of filesToViolations.values()) {
            violationCount += violations;
        }

        // Number of <K,V> pairs in filesToViolations is fileCount
        fileCount = filesToViolations.size;

        return [violationCount, fileCount];
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

    protected getPluginJsonTemplate(): any {
        return {
            "groupId": "com.github.spotbugs",
            "artifactId": "spotbugs-maven-plugin",
            "version": "4.5.2.0",
            "dependencies": [
                {
                    "groupId": "com.github.spotbugs",
                    "artifactId": "spotbugs",
                    "version": "4.5.3",
                }
            ]
        }
    }
    protected addSpotbugsNodes(buildJsonContent: any) {
        const _this = this;

        const buildNode = _this.getBuildDataNode(buildJsonContent);
        const pluginsNode = _this.getPluginDataNode(buildNode);
        const content = _this.getPluginJsonTemplate();
        util.addPropToJson(pluginsNode, "plugin", content);

        return pluginsNode
        // return Q.resolve(buildJsonContent);
    }

    protected addSpotbugsData(pomJson: any) {
        const _this = this;

        tl.debug('adding spotbugs data')

        if (!pomJson.project) {
            // Q.reject(tl.loc("InvalidBuildFile"));
            throw new Error(tl.loc("InvalidBuildFile"))
        }

        let isMultiModule = false;
        if (pomJson.project.modules) {
            tl.debug("Multimodule project detected");
            isMultiModule = true;
        }

        const mavenPOMFile: string = tl.getPathInput('mavenPOMFile', true, true);

        const promises = [_this.addSpotbugsPluginData(mavenPOMFile, pomJson)];
        // if (isMultiModule) {
        //     promises.push(_this.createMultiModuleReport(_this.reportDir));
        // }

        return Promise.all(promises);
    }

    protected async addSpotbugsPluginData(buildFile: string, pomJson: any) {
        const _this = this;

        tl.debug(`PomJson ${JSON.stringify(pomJson)}`)

        const nodes = await _this.addSpotbugsNodes(pomJson)

        await util.writeJsonAsXmlFile(buildFile, nodes)

        // .then(function (content) {
        //     return util.writeJsonAsXmlFile(buildFile, content);
        // });

    }
}
