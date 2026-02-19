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
