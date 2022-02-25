import * as tl from 'azure-pipelines-task-lib/task';

import { addPropToJson, readXmlFileAsJson, writeJsonAsXmlFile } from './utils';

async function updatePomFile(mavenPOMFile: string) {
    try {
        const pomJson = await readXmlFileAsJson(mavenPOMFile)

        await addSpotbugsData(pomJson)
    }
    catch (err) {
        tl.error("Error when updating the POM file: " + err)
        throw err
    }
}

// Note: the Spotbugs maven plugin and spotbugs itself are different packages. Need to think about how to implement both
function getSpotBugsMavenPluginVersion(): string {
    const userSpecifiedVersion = tl.getInput('spotbugsMavenPluginVersion');
    if (userSpecifiedVersion) {
        return userSpecifiedVersion.trim();
    }
    return '4.5.3.0';
}

async function addSpotbugsData(pomJson: any) {
    tl.debug('Adding spotbugs data')

    if (!pomJson.project) {
        throw new Error(tl.loc("InvalidBuildFile"))
    }

    let isMultiModule = false;
    if (pomJson.project.modules) {
        tl.debug("Multimodule project detected");
        isMultiModule = true;
    }

    const mavenPOMFile: string = tl.getPathInput('mavenPOMFile', true, true);

    const promises = [addSpotbugsPluginData(mavenPOMFile, pomJson)];

    return await Promise.all(promises);
}

async function addSpotbugsPluginData(buildFile: string, pomJson: any) {

    const nodes = addSpotbugsNodes(pomJson)

    tl.debug('Final JSon Content:')

    console.dir({ nodes }, { depth: Infinity, colors: true })

    pomJson.project.build[0].plugins[0] = nodes

    writeJsonAsXmlFile(buildFile, pomJson)
}

function addSpotbugsNodes(buildJsonContent: any) {

    tl.debug('Adding the spotbugs data nodes')

    const buildNode = getBuildDataNode(buildJsonContent);
    const pluginsNode = getPluginDataNode(buildNode);
    const content = getPluginJsonTemplate("4.5.3");

    addPropToJson(pluginsNode, "plugin", content);

    return pluginsNode
}

function getBuildDataNode(buildJsonContent: any) {
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

function getPluginJsonTemplate(spotbugsPluginVersion: string): any {
    return {
        "groupId": ["com.github.spotbugs"],
        "artifactId": ["spotbugs-maven-plugin"],
        "version": [spotbugsPluginVersion],
    }
}

function getPluginDataNode(buildNode: any): any {
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

export async function enablePluginForMaven() {
    tl.debug('Maven plugin tool enabled')
    const specifyPluginVersion = tl.getInput('spotbugsMavenPluginVersionChoice') === 'specify';
    tl.debug('Specify plugin version = ' + specifyPluginVersion)
    if (specifyPluginVersion) {
        const pluginVersion: string = getSpotBugsMavenPluginVersion();
        tl.debug('Specified pluginVersion ' + pluginVersion)
    }

    const mavenPOMFile: string = tl.getPathInput('mavenPOMFile', true, true);

    await updatePomFile(mavenPOMFile)

    tl.debug('POM file was successfully updated')
}
