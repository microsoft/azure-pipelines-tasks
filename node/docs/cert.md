### Get certificate configuration by using [AZURE-PIPELINES-TASK-LIB](https://github.com/Microsoft/azure-pipelines-task-lib) method (Min Agent Version 2.122.0)

#### Node.js Lib

Method for retrieve certificate settings in node.js lib
``` typescript
export function getHttpCertConfiguration(): CertConfiguration {
}
```
`CertConfiguration` has following fields
```typescript
export interface CertConfiguration {
     caFile?: string;
     certFile?: string;
     keyFile?: string;
     certArchiveFile?: string;
     passphrase?: string;
 }
```

In the following example, we will retrieve certificate configuration information and use VSTS-Node-Api to make a Rest Api call back to VSTS/TFS service, the Rest call will use the certificates you configured in agent.
```typescript
// MyCertExampleTask.ts
import tl = require('azure-pipelines-task-lib/task');
import api = require('vso-node-api');
import VsoBaseInterfaces = require('vso-node-api/interfaces/common/VsoBaseInterfaces');

async function run() {

    // get cert config
    let cert = tl.getHttpCertConfiguration();

    // TFS server url
    let serverUrl = "https://mycompanytfs.com/tfs";

    // Personal access token
    let token = "<YOUR_TOKEN_HERE>";
    let authHandler = api.getPersonalAccessTokenHandler(token);

    // Options for VSTS-Node-Api, 
    // this is not required if you want to send http request to the same TFS
    // instance the agent currently connect to.
    // VSTS-Node-Api will pick up certificate setting from azure-pipelines-task-lib automatically 
    let option: VsoBaseInterfaces.IRequestOptions = {
        cert: {
                caFile: "C:\\ca.pem",
                certFile: "C:\\client-cert.pem",
                keyFile: "C:\\client-cert-key.pem",
                passphrase: "test123",
            }
        };
    
    // Make a Rest call to VSTS/TFS
    let vsts: api.WebApi = new api.WebApi(serverUrl, authHandler, option);
    let connData: lim.ConnectionData = await vsts.connect();
    console.log('Hello ' + connData.authenticatedUser.providerDisplayName);

    // You should only use the retrieved certificate config to call the TFS instance your agent current connect to or any resource within your cooperation that accept those certificates.
}

run();
```

#### PowerShell Lib

On Windows the CA certificate needs to be installed into the `Trusted CA Store` of `Windows Certificate manager` first.
So the PowerShell lib will only expose the client certificate information

Method for retrieve client certificate settings in PowerShell lib
``` powershell
function Get-ClientCertificate {
    [CmdletBinding()]
    param()

    # Return a new X509Certificate2 object to the client certificate
    return New-Object -TypeName System.Security.Cryptography.X509Certificates.X509Certificate2
}
```

In the following example, we will retrieve client certificate configuration information and print it out first, then we will use PowerShell lib method to get `VssHttpClient` and make a Rest Api call back to TFS service's `Project` endpoint and retrieve all team projects. The Rest call will use the client certificate you configured in agent.

```powershell
# retrieve cert config
$cert = Get-VstsClientCertificate
Write-Host $cert

# get project http client (the client will have proxy hook up by default)
$projectHttpClient = Get-VstsVssHttpClient -TypeName Microsoft.TeamFoundation.Core.WebApi.ProjectHttpClient -OMDirectory "<Directory that contains required .dlls>"

# print out all team projects
$projectHttpClient.GetProjects().Result
```