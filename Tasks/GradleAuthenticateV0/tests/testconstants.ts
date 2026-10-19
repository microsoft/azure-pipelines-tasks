// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

/**
 * Environment variable keys used to pass configuration from test scenarios
 * into the TestSetup child process. Double-underscore convention matches
 * the azure-pipelines-tasks repo pattern.
 */
export const TestEnvVars = {
    buildFiles: '__buildFiles__',
    repositoryUrl: '__repositoryUrl__',
    adoServiceConnection: '__adoServiceConnection__',
    pluginToolVersion: '__pluginToolVersion__',
    gradleUserHome: '__gradleUserHome__',
};

/**
 * Shared test data constants.
 */
export const TestData = {
    feedUrl: 'https://pkgs.dev.azure.com/testorg/testproject/_packaging/testfeed/maven/v1',
    feedUrl2: 'https://pkgs.dev.azure.com/testorg/testproject/_packaging/testfeed2/maven/v1',
    accessToken: 'test-access-token-value',
    pluginVersion: '1.0.0',
    dynamicPluginVersion: '1.+',
    serviceConnectionId: 'test-service-connection-id',
    clientId: 'test-client-id',
    tenantId: 'test-tenant-id',
    oidcRequestUri: 'https://dev.azure.com/testorg/test-project-id/_apis/distributedtask/hubs/build/plans/test-plan-id/jobs/test-job-id/oidctoken',
};
