// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

/**
 * Generate the Gradle init script that:
 * 1. Loads the CI JAR via initscript classpath from the local file:// repo
 * 2. Applies the plugin at the Gradle level
 * 3. Injects the local repo into pluginManagement.repositories via beforeSettings
 *
 * @param version The credprovider plugin version, or '+' to resolve the latest from the local repo.
 */
export function generateInitScript(version: string): string {
    return `// azure-artifacts-auth.gradle — written by GradleAuthenticate@0.
// Deleted automatically after the build step completes.
// Loaded BEFORE settings.gradle. The plugin is applied at the Gradle level via
// initscript classpath, and the local file:// repo is injected into
// pluginManagement.repositories via beforeSettings so that the settings.gradle
// plugins {} block resolves from the local layout (no network request).

initscript {
    // initscript { repositories } is ISOLATED — does not affect project repositories.
    // ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO points to a Maven local repo laid out by GradleAuthenticate.
    repositories {
        maven {
            name = 'AzureArtifactsCI'
            url = uri("file://\${System.getenv('ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO')}")
            content {
                includeModule 'com.microsoft.azure', 'artifacts-gradle-credprovider'
            }
        }
    }
    dependencies {
        classpath 'com.microsoft.azure:artifacts-gradle-credprovider:${version}'
    }
}

apply plugin: com.microsoft.azure.artifacts.credprovider.gradle.GradleCredentialProviderPlugin

// Inject the local Maven repo into pluginManagement.repositories so that
// the \`plugins { id '...' version '...' }\` declaration in settings.gradle
// resolves from our local file:// repo instead of attempting to download
// from Gradle Plugin Portal.
//
// NOTE: \`apply plugin\` at the Gradle level does NOT pre-empt the \`plugins {}\`
// block in settings.gradle — Gradle still resolves the plugin artifact through
// pluginManagement.repositories. This hook ensures that resolution succeeds
// from the local layout. A plugin marker POM must be present in the layout.
beforeSettings { settings ->
    def ciRepoUrl = System.getenv('ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO')
    if (ciRepoUrl) {
        settings.pluginManagement {
            repositories {
                maven {
                    name = 'AzureArtifactsCI-PluginMgmt'
                    url = uri("file://\${ciRepoUrl}")
                    content {
                        includeModule 'com.microsoft.azure', 'artifacts-gradle-credprovider'
                        includeModule 'com.microsoft.azure.artifacts.credprovider', 'com.microsoft.azure.artifacts.credprovider.gradle.plugin'
                    }
                }
            }
        }
    }
}
`;
}
