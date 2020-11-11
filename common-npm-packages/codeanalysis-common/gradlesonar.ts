import Q = require('q');
import path = require('path');
import fs = require('fs');

import * as tl from 'azure-pipelines-task-lib/task';
import * as trm from 'azure-pipelines-task-lib/toolrunner';

// Apply arguments to enable SonarQube analysis.
// Returns the changed toolRunner. Has no effect if SonarQube is not enabled.
export function applyEnabledSonarQubeArguments(gradleRun: trm.ToolRunner | any): trm.ToolRunner | any {

    const specifyPluginVersion = tl.getInput('sqGradlePluginVersionChoice') === 'specify';
    if (specifyPluginVersion) {
        // #1: Inject custom script to the Gradle build, triggering a SonarQube run
        // Add a custom initialisation script to the Gradle run that will apply the SonarQube plugin and task
        // Set the SonarQube Gradle plugin version in the script
        const pluginVersion: string = getSonarQubeGradlePluginVersion();
        let initScriptPath: string = path.join(__dirname, 'sonar.gradle');
        let scriptContents: string= fs.readFileSync(initScriptPath, 'utf8');
        scriptContents = scriptContents.replace('SONARQUBE_GRADLE_PLUGIN_VERSION', pluginVersion);
        tl.writeFile(initScriptPath, scriptContents);
        // Specify that the build should run the init script
        gradleRun.arg(['-I', initScriptPath]);
    }

    gradleRun.arg(['sonarqube']);

    return gradleRun;
}

function getSonarQubeGradlePluginVersion(): string {
    let pluginVersion = '2.6.1';
    let userSpecifiedVersion = tl.getInput('sqGradlePluginVersion');
    if (userSpecifiedVersion) {
        pluginVersion = userSpecifiedVersion.trim();
    }
    return pluginVersion;
}

