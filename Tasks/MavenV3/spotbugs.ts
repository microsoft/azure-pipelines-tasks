import * as tl from 'azure-pipelines-task-lib/task';

import { addPropToJson, readXmlFileAsJson, writeJsonAsXmlFile } from './utils';

/**
 * Gets the json version of the POM file and adds the plugin parameters to it
 * @param mavenPOMFile  - path to the POM file
 */
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

/**
 * Adds the new data to the POM file
 * @param pomJson - JSON schema of the POM file
 */
async function addSpotbugsData(pomJson: any) {
    tl.debug('Adding spotbugs data')

    if (!pomJson.project) {
        throw new Error(tl.loc("InvalidBuildFile"))
    }

    const mavenPOMFile: string = tl.getPathInput('mavenPOMFile', true, true);

    return await addSpotbugsPluginData(mavenPOMFile, pomJson)
}

/**
 * Gets the plugin nodes and adds it to the original json schema. After that writes the schema to the POM file as XML
 * @param buildFile - POM file
 * @param pomJson - POM file json schema
 */
async function addSpotbugsPluginData(buildFile: string, pomJson: any) {

    const nodes = addSpotbugsNodes(pomJson)

    tl.debug('Final JSon Content:')

    pomJson.project.build[0].plugins[0] = nodes

    writeJsonAsXmlFile(buildFile, pomJson)
}

/**
 * Adds spotbugs nodes to the parent plugins node of the POM file json schema
 * @param buildJsonContent - original json content of the POM file
 */
function addSpotbugsNodes(buildJsonContent: any) {

    tl.debug('Adding the spotbugs data nodes')

    const buildNode = getBuildDataNode(buildJsonContent);
    const pluginsNode = getPluginDataNode(buildNode);

    const spotbugsPluginVersion = tl.getInput('spotbugsMavenPluginVersion');
    const content = getPluginJsonTemplate(spotbugsPluginVersion);

    addPropToJson(pluginsNode, "plugin", content);

    return pluginsNode
}

/**
 * Gets the build node from the POM file json schema
 * @param buildJsonContent - POM file json schema
 */
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

/**
 * Returns the plugin data node of the POM json schema
 * @param buildNode - build node of the POM config json schema
 */
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

/**
 * Impelements the Spotbugs plugin to the Project POM file
 */
export async function AddSpotbugsPlugin() {
    const mavenPOMFile: string = tl.getPathInput('mavenPOMFile', true, true);

    await updatePomFile(mavenPOMFile)

    tl.debug('POM file was successfully updated')
}
