export const environmentData = {
  subscriptionId: '00000000-0000-0000-0000-000000000000',
  resourceGroupName: 'mock-resource-group',
  subscriptionName: 'mock-subscription',
  location: 'eastus',
};

export function setupMockAzureEndpoint(connectedServiceName: string = 'AzureRM') {
  // Set minimal environment variables needed for authentication in main.ts
  // These are read by tl.getEndpointAuthorizationScheme() and tl.getEndpointAuthorizationParameter()
  // Azure SDK calls are mocked, so no other endpoint data is needed
  process.env[`ENDPOINT_AUTH_SCHEME_${connectedServiceName}`] = 'ServicePrincipal';
  process.env[`ENDPOINT_AUTH_PARAMETER_${connectedServiceName}_SERVICEPRINCIPALID`] = 'mock-sp-id';
  process.env[`ENDPOINT_AUTH_PARAMETER_${connectedServiceName}_SERVICEPRINCIPALKEY`] = 'mock-sp-key';
  process.env[`ENDPOINT_AUTH_PARAMETER_${connectedServiceName}_TENANTID`] = 'mock-tenant-id';
}

export function createMockRestError(message: string, error: any, correlationId: string = 'test-correlation-id'): any {
  const restError: any = new Error(message);
  restError.name = 'RestError';
  restError.code = 'RestError';
  restError.statusCode = 400;
  restError.response = { 
    headers: {
      get: (name: string) => name === 'x-ms-correlation-request-id' ? correlationId : undefined
    }
  };
  restError.details = { error };
  return restError;
}

export function createValidationFailureError(deploymentName: string = 'e2e-validate', trackingId: string = 'test-tracking-id') {
  return {
    code: "InvalidTemplateDeployment",
    message: `The template deployment '${deploymentName}' is not valid according to the validation procedure. The tracking id is '${trackingId}'. See inner errors for details.`,
    details: [
      {
        code: "PreflightValidationCheckFailed",
        message: "Preflight validation failed. Please refer to the details for the specific errors.",
        details: [
          {
            code: "StorageAccountAlreadyTaken",
            message: "The storage account named foo is already taken.",
            target: "foo"
          }
        ]
      }
    ]
  };
}

// Mock for AzureAuthenticationHelper - used with tmrm.registerMock
export function createMockAuthHelper() {
  return {
    AzureAuthenticationHelper: function() {
      return {
        loginAzure: function() {
          console.log('[MOCK] loginAzure called');
          return Promise.resolve();
        },
        logoutAzure: function() {
          console.log('[MOCK] logoutAzure called');
          return;
        }
      };
    }
  };
}

// Register tool-lib mock to prevent real tool cache operations (tl.stats crash on mock paths)
export function registerToolLibMock(tr: any) {
  const path = require('path');
  tr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: function(_toolName: string, _versionSpec: string, _arch?: string) { return undefined; },
    cacheFile: function(_sourceFile: string, _targetFile: string, _tool: string, _version: string, _arch?: string) {
      return path.join(__dirname, '_tools', 'bicep', _version, _arch || 'x64');
    },
  });
  process.env['AGENT_TOOLSDIRECTORY'] = path.join(__dirname, '_tools');
}

// Create a TaskMockRunner with common mocks and inputs pre-registered
export function createTaskMockRunner(rewiremock?: any) {
  const path = require('path');
  const tmrm = require('azure-pipelines-task-lib/mock-run');
  const taskPath = path.join(__dirname, '..', 'main.js');
  const tr = new tmrm.TaskMockRunner(taskPath);
  setupMockAzureEndpoint('AzureRM');
  tr.registerMock('./auth', createMockAuthHelper());
  registerToolLibMock(tr);
  if (rewiremock) {
    const { createBicepNodeMock } = require('./bicepNodeMock');
    rewiremock('bicep-node').with(createBicepNodeMock());
  }
  tr.setInput('ConnectedServiceName', 'AzureRM');
  tr.setInput('scope', 'resourceGroup');
  tr.setInput('subscriptionId', environmentData.subscriptionId);
  tr.setInput('resourceGroupName', environmentData.resourceGroupName);
  return tr;
}

// Create a TaskMockRunner pre-configured for deployment tests
export function createDeploymentMockRunner(rewiremock?: any) {
  const tr = createTaskMockRunner(rewiremock);
  tr.setInput('type', 'deployment');
  return tr;
}

// Create a TaskMockRunner pre-configured for deployment stack tests
export function createStackMockRunner(rewiremock?: any) {
  const tr = createTaskMockRunner(rewiremock);
  tr.setInput('type', 'deploymentStack');
  tr.setInput('actionOnUnmanageResources', 'detach');
  tr.setInput('actionOnUnmanageResourceGroups', 'detach');
  tr.setInput('denySettingsMode', 'none');
  return tr;
}
