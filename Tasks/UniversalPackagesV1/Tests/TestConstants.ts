export const TEST_CONSTANTS = {
    FEED_NAME: 'TestFeed',
    PROJECT_SCOPED_FEED_NAME: 'TestProject/TestFeed',
    PROJECT_NAME: 'TestProject',
    PACKAGE_NAME: 'TestPackage',
    PACKAGE_VERSION: '1.0.0',
    HIGHEST_PACKAGE_VERSION: '1.2.3',
    DOWNLOAD_PATH: 'c:\\temp',
    ORGANIZATION_NAME: 'example',
    SERVICE_URL: 'https://dev.azure.com/example',
    CROSS_ORG_SERVICE_URL: 'https://dev.azure.com/other-org',
    ARTIFACT_TOOL_PATH: 'c:\\mock\\location\\ArtifactTool.exe',
    
    // Test output messages
    SUCCESS_OUTPUT: 'ArtifactTool.exe output',
    ERROR_MESSAGE: 'ArtifactTool error message',
    
    // Publish-specific
    PACKAGE_DESCRIPTION: '"Test package description"',
    PROVENANCE_SESSION_ID: 'session-12345678-1234-1234-1234-123456789abc',
    
    // Authentication
    WIF_TOKEN: 'wif-token-12345',
    SYSTEM_TOKEN: 'system-token-67890',
    SERVICE_CONNECTION_NAME: 'TestServiceConnection',
    MOCK_TENANT_ID: '12345678-1234-1234-1234-123456789abc'
};

// Default environment variables for all tests
export function getDefaultEnvVars(): { [key: string]: string } {
    return {
        'INPUT_PACKAGEVERSION': TEST_CONSTANTS.PACKAGE_VERSION,
        'AGENT_HOMEDIRECTORY': 'c:\\agent\\home\\directory',
        'AGENT_VERSION': '2.999.0',
        'BUILD_SOURCESDIRECTORY': 'c:\\agent\\home\\directory\\sources',
        'ENDPOINT_URL_SYSTEMVSSCONNECTION': 'https://dev.azure.com/example',
        'SYSTEM_DEFAULTWORKINGDIRECTORY': 'c:\\agent\\home\\directory',
        'SYSTEM_TEAMFOUNDATIONCOLLECTIONURI': 'https://dev.azure.com/example',
        'SYSTEM_SERVERTYPE': 'hosted',
        'SYSTEM_DEBUG': 'false',
        'MOCK_HIGHEST_PACKAGE_VERSION': TEST_CONSTANTS.HIGHEST_PACKAGE_VERSION
    };
}
