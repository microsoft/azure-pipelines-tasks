import * as tl from 'azure-pipelines-task-lib/task';
import { BuildOutput } from 'azure-pipelines-tasks-codeanalysis-common/Common/BuildOutput';
import { ModuleOutput } from 'azure-pipelines-tasks-codeanalysis-common/Common/ModuleOutput';
import * as path from 'path';

import { addPropToJson, copyFile, readXmlFileAsJson, writeJsonAsXmlFile } from './utils';

/**
 * Gets the plugin nodes and adds it to the original json schema. After that writes the schema to the POM file as XML
 * @param pomFile - POM file
 * @param pomJson - POM file json schema
 */
async function addSpotbugsPluginData(pomFile: string, pomJson: any) {

    const nodes = addSpotbugsNodes(pomJson)

    pomJson.project.build[0].plugins[0] = nodes

    writeJsonAsXmlFile(pomFile, pomJson)
}

/**
 * Adds spotbugs nodes to the parent plugins node of the POM file json schema
 * @param pomJson - original json content of the POM file
 */
function addSpotbugsNodes(pomJson: any) {

    tl.debug('Adding the spotbugs data nodes')

    const buildNode = getBuildNode(pomJson);
    const pluginsNode = getPluginsNode(buildNode);

    const spotbugsPluginVersion = tl.getInput('spotbugsMavenPluginVersion');
    const content = getSpotbugsPluginJsonTemplate(spotbugsPluginVersion);

    addPropToJson(pluginsNode, "plugin", content);

    return pluginsNode
}

/**
 * Gets the build node from the POM file json schema
 * @param pomJson - POM file json schema
 */
function getBuildNode(pomJson: any) {
    let buildNode = null;
    if (!pomJson.project.build || typeof pomJson.project.build === "string") {
        buildNode = {};
        pomJson.project.build = buildNode;
    } else if (pomJson.project.build instanceof Array) {
        if (typeof pomJson.project.build[0] === "string") {
            buildNode = {};
            pomJson.project.build[0] = buildNode;
        } else {
            buildNode = pomJson.project.build[0];
        }
    }
    return buildNode;
}

function getSpotbugsPluginJsonTemplate(spotbugsPluginVersion: string): any {
    return {
        "groupId": ["com.github.spotbugs"],
        "artifactId": ["spotbugs-maven-plugin"],
        "version": [spotbugsPluginVersion],
    }
}

/**
 * Returns the plugin data node of the POM json schema
 * @param buildNode - build node of the POM config json schema
 */
function getPluginsNode(buildNode: any): any {
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

/**
 * Impelements the Spotbugs plugin to the Project POM file
 */
export async function AddSpotbugsPlugin() {
    const mavenPOMFile: string = tl.getPathInput('mavenPOMFile', true, true);

    try {
        const pomJson = await readXmlFileAsJson(mavenPOMFile)
        if (!pomJson.project) {
            throw new Error(tl.loc("InvalidBuildFile"))
        }

        tl.debug('Adding spotbugs plugin data')
        return await addSpotbugsPluginData(mavenPOMFile, pomJson)
    }
    catch (err) {
        tl.error("Error when updating the POM file: " + err)
        throw err
    }
}

export function PublishSpotbugsReport(buildOutput: BuildOutput) {
    let outputs: ModuleOutput[] = buildOutput.findModuleOutputs();
    tl.debug(`[CA] ${'Spotbugs'} parser found ${outputs.length} possible modules to upload results from.`);

    const mavenPOMFile: string = tl.getPathInput('mavenPOMFile', true, true);
    const buildRootPath = path.dirname(mavenPOMFile);
    const reportsPath = path.join(buildRootPath, 'target')

    const reportFile = path.join(reportsPath, 'spotbugsXml.xml')

    const stagingDir: string = path.join(tl.getVariable('build.artifactStagingDirectory'), '.codeAnalysis');
    const buildNumber: string = tl.getVariable('build.buildNumber');

    const artifactBaseDir: string = path.join(stagingDir, 'CA');

    const destinationDir: string = path.join(artifactBaseDir, outputs[0].moduleName);

    const extension: string = path.extname(reportFile);
    const reportName: string = path.basename(reportFile, extension);

    const artifactName: string = `${buildNumber}_${reportName}_${'Spotbugs'}${extension}`;
    copyFile(reportFile, path.join(destinationDir, artifactName));

    tl.command('artifact.upload',
        { 'artifactname': tl.loc('codeAnalysisArtifactSummaryTitle') },
        artifactBaseDir);
}

