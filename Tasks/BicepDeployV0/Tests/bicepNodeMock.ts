import * as path from 'path';
import * as fs from 'fs';

// Read JSON test files to return from compile/compileParams mocks
function readTestFile(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
}

// Map of .bicep/.bicepparam files to their JSON equivalents for mocking compilation
const fileMap: Record<string, { template: string; parameters?: string }> = {
  'basic': {
    template: readTestFile('files/basic/main.json'),
    parameters: readTestFile('files/basic/main.parameters.json'),
  },
  'deployerror': {
    template: JSON.stringify({
      "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
      "contentVersion": "1.0.0.0",
      "parameters": { "input": { "type": "string" } },
      "resources": [],
      "outputs": { "accessTier": { "type": "string", "value": "[reference(resourceId('Microsoft.Storage/storageAccounts', parameters('input')), '2019-06-01').accessTier]" } }
    }),
    parameters: JSON.stringify({
      "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
      "contentVersion": "1.0.0.0",
      "parameters": { "input": { "value": "foo" } }
    }),
  },
  'validationerror': {
    template: JSON.stringify({
      "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
      "contentVersion": "1.0.0.0",
      "parameters": { "input": { "type": "string" } },
      "resources": [{
        "type": "Microsoft.Storage/storageAccounts",
        "apiVersion": "2019-06-01",
        "name": "[parameters('input')]",
        "location": "[resourceGroup().location]",
        "kind": "StorageV2",
        "sku": { "name": "Standard_LRS" }
      }]
    }),
    parameters: JSON.stringify({
      "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
      "contentVersion": "1.0.0.0",
      "parameters": { "input": { "value": "foo" } }
    }),
  },
};

function resolveFileSet(filePath: string): { template: string; parameters?: string } {
  for (const [key, value] of Object.entries(fileMap)) {
    if (filePath.includes(key)) {
      return value;
    }
  }
  // Default to basic template
  return fileMap['basic'];
}

/**
 * Creates a mock for the 'bicep-node' module that avoids real Bicep WASM
 * initialization and download. Instead, compile/compileParams return
 * pre-built JSON matching the test fixture .bicep files.
 */
export function createBicepNodeMock() {
  return {
    Bicep: {
      getDownloadUrl: async () => 'https://downloads.bicep.azure.com/v1.2.3/bicep-linux-x64',
      install: async (_dir: string, _version?: string) => '/mock/path/to/bicep',
      initialize: async (_binaryPath: string) => ({
        compile: async (opts: { path: string }) => {
          const fileSet = resolveFileSet(opts.path);
          return {
            success: true,
            contents: fileSet.template,
            diagnostics: [],
          };
        },
        compileParams: async (opts: { path: string; parameterOverrides?: Record<string, unknown> }) => {
          const fileSet = resolveFileSet(opts.path);
          return {
            success: true,
            template: fileSet.template,
            parameters: fileSet.parameters ?? '{}',
            templateSpecId: undefined,
            diagnostics: [],
          };
        },
        version: () => '1.2.3',
        dispose: () => {},
      }),
    },
  };
}
