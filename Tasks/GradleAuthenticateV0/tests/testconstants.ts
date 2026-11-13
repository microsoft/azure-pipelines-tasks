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
    agentTempDirectory: '__agentTempDirectory__',
    existingRepoDir: '__existingRepoDir__',
    existingAuthConfig: '__existingAuthConfig__',
    ciProviderScenario: '__ciProviderScenario__',
    jobId: '__jobId__',
    jobAttempt: '__jobAttempt__',
    postexecInitScript: '__postexec_initScriptPath__',
    postexecTemp: '__postexec_tempDir__',
    postexecDryRun: '__postexec_dryRun__',
    postexecRealVariables: '__postexec_realVariables__',
    initScriptIdentity: '__initScriptIdentity__',
    initScriptBirthtime: '__initScriptBirthtime__',
    postexecReusedInode: '__postexec_reusedInode__',
};

/**
 * Shared test data constants.
 */
export const TestData = {
    initScriptIdentityVariable: 'ARTIFACTS_GRADLE_AUTH_INIT_SCRIPT_IDENTITY',
    jobId: '01234567-89ab-cdef-0123-456789abcdef',
    otherJobId: 'fedcba98-7654-3210-fedc-ba9876543210',
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
