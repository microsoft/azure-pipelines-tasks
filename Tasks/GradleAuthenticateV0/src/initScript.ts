// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import { assertSafePluginVersions } from './utils/pluginVersionUtils';

/**
 * Generate the Gradle init script that:
 * 1. Loads the CI JAR via initscript classpath from the local file:// repo
 * 2. Applies the plugin at the Gradle level
 * 3. Injects the local repo into pluginManagement.repositories via beforeSettings
 *
 * @param version The credprovider plugin version, or '+' to resolve the latest from the local repo.
 * @param jobKey The validated job ID/attempt used to name the owning job's resources.
 */
export function generateInitScript(version: string, jobKey: string): string {
    assertSafePluginVersions([version]);
    const ownsJob = `'${jobKey}' == (System.getenv('SYSTEM_JOBID')?.toLowerCase(java.util.Locale.ROOT) + '-' + System.getenv('SYSTEM_JOBATTEMPT'))`;

    return `// azure-artifacts-auth.gradle — written by GradleAuthenticate@0.
// Deleted automatically after the build step completes.
// Loaded BEFORE settings.gradle. The plugin is applied at the Gradle level via
// initscript classpath, and the local file:// repo is injected into
// pluginManagement.repositories via beforeSettings so that the settings.gradle
// plugins {} block resolves from the local layout (no network request).

initscript {
    // Gradle loads every init.d script, including scripts left by other jobs.
    if (${ownsJob}) {
        repositories {
            maven {
                name = 'AzureArtifactsCI'
                url = new File(System.getenv('ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO')).toURI()
                content {
                    includeModule 'com.microsoft.azure', 'artifacts-gradle-credprovider'
                }
            }
        }
        dependencies {
            classpath 'com.microsoft.azure:artifacts-gradle-credprovider:${version}'
        }
    }
}

if (${ownsJob}) {
    apply plugin: com.microsoft.azure.artifacts.credprovider.gradle.GradleCredentialProviderPlugin

    // The settings plugins block still needs a local repository and marker POM.
    beforeSettings { settings ->
        def ciRepoUrl = System.getenv('ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO')
        if (ciRepoUrl) {
            settings.pluginManagement {
                repositories {
                    maven {
                        name = 'AzureArtifactsCI-PluginMgmt'
                        url = new File(ciRepoUrl).toURI()
                        content {
                            includeModule 'com.microsoft.azure', 'artifacts-gradle-credprovider'
                            includeModule 'com.microsoft.azure.artifacts.credprovider', 'com.microsoft.azure.artifacts.credprovider.gradle.plugin'
                        }
                    }
                }
            }
        }
    }
}
`;
}
