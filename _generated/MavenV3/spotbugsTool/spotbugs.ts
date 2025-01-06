// TODO: This file should be moved to the common package as a spotbugs tool
import * as tl from 'azure-pipelines-task-lib/task';
import { addPropToJson, readXmlFileAsJson, writeJsonAsXmlFile } from '../utils';

interface SpotBugsPluginArgs {
    spotbugsPluginVersion: string;
    failOnError: boolean;
}

/**
 * Gets the plugin nodes and adds it to the original json schema. After that writes the schema to the POM file as XML
 * @param pomFile - POM file
 * @param pomJson - POM file json schema
 */
async function addSpotbugsPluginData(pomFile: string, pomJson: any): Promise<void> {

    const nodes = addSpotbugsNodes(pomJson);

    pomJson.project.build[0].plugins = [nodes];

    return writeJsonAsXmlFile(pomFile, pomJson);
}

/**
 * Adds spotbugs nodes to the parent plugins node of the POM file json schema
 * @param pomJson - original json content of the POM file
 */
function addSpotbugsNodes(pomJson: any): any {

    tl.debug('Adding the spotbugs data nodes');

    const buildNode = getBuildNode(pomJson);
    const pluginsNode = getPluginsNode(buildNode);

    const spotbugsPluginVersion = tl.getInput('spotBugsMavenPluginVersion');
    const isFailWhenFoundBugs = tl.getBoolInput('spotBugsFailWhenBugsFound', false);

    const spotbugsPluginArgs: SpotBugsPluginArgs = {
        spotbugsPluginVersion: spotbugsPluginVersion,
        failOnError: isFailWhenFoundBugs
    };

    const content = getSpotbugsPluginJsonTemplate(spotbugsPluginArgs);

    addPropToJson(pluginsNode, 'plugin', content);

    return pluginsNode;
}

/**
 * Gets the build node from the POM file json schema
 * @param pomJson - POM file json schema
 */
function getBuildNode(pomJson: any): any {
    let buildNode = {};
    if (!pomJson.project.build || typeof pomJson.project.build === 'string') {
        pomJson.project.build = [buildNode];
    } else if (pomJson.project.build instanceof Array) {
        if (typeof pomJson.project.build[0] === 'string') {
            pomJson.project.build = [buildNode];
        } else {
            buildNode = pomJson.project.build[0];
        }
    }
    return buildNode;
}

/**
 * Returns the json schema of the spotbugs plugin for the Maven
 * Refers to: https://spotbugs.github.io/spotbugs-maven-plugin/usage.html#generate-spotbugs-report-as-part-of-the-project-reports
 * @param pluginArgs - arguments for configuring the spotbugs plugin
 * @returns Json schema of the spotbugs plugin
 */
function getSpotbugsPluginJsonTemplate(pluginArgs: SpotBugsPluginArgs): any {
    return {
        'groupId': ['com.github.spotbugs'],
        'artifactId': ['spotbugs-maven-plugin'],
        'version': [pluginArgs.spotbugsPluginVersion],
        'configuration': [
            {
                'failOnError': [pluginArgs.failOnError]
            }
        ]
    };
}

/**
 * Returns the plugin data node of the POM json schema
 * @param buildNode - build node of the POM config json schema
 */
function getPluginsNode(buildNode: any): any {
    let pluginsNode = {};

    /* Always look for plugins node first */
    if (buildNode.plugins) {
        if (typeof buildNode.plugins === 'string') {
            buildNode.plugins = {};
        }
        if (buildNode.plugins instanceof Array) {
            if (typeof buildNode.plugins[0] === 'string') {
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
export async function AddSpotbugsPlugin(mavenPOMFile: string): Promise<void> {
    try {
        const pomJson = await readXmlFileAsJson(mavenPOMFile);
        if (!pomJson.project) {
            throw new Error(tl.loc('InvalidBuildFile'));
        }

        tl.debug('Adding spotbugs plugin data');
        return await addSpotbugsPluginData(mavenPOMFile, pomJson);
    } catch (err) {
        tl.error('Error when updating the POM file: ' + err);
        throw err;
    }
}
