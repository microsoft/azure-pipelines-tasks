### Get proxy configuration by using [AZURE-DEVOPS-TASK-LIB](https://github.com/Microsoft/azure-pipelines-task-lib) method

#### Node.js Lib

Method for retrieve proxy settings in node.js lib
``` typescript
export function getHttpProxyConfiguration(): ProxyConfiguration {
}
```
`ProxyConfiguration` has following fields
```typescript
export interface ProxyConfiguration {
     proxyUrl: string;
     proxyUsername?: string;
     proxyPassword?: string;
     proxyBypassHosts?: string[];
     proxyFormattedUrl: string;
 }
```

In the following example, we will retrieve proxy configuration information and use VSTS-Node-Api to make a Rest Api call back to VSTS/TFS service, the Rest call will go through the web proxy you configured in `.proxy` file.
```typescript
// MyProxyExampleTask.ts
import tl = require('azure-pipelines-task-lib/task');
import api = require('vso-node-api');
import VsoBaseInterfaces = require('vso-node-api/interfaces/common/VsoBaseInterfaces');

async function run() {

    // get proxy config
    let proxy = tl.getHttpProxyConfiguration();

    // VSTS/TFS server url
    let serverUrl = "https://myaccount.visualstudio.com";

    // Personal access token
    let token = "g6zzur6bfypfwuqdxxupv3y3qfcoudlgh26bjz77t3mgylzmvjiq";
    let authHandler = api.getPersonalAccessTokenHandler(token);

    // Options for VSTS-Node-Api, 
    // this is not required if you want to send http request to the same VSTS/TFS
    // instance the agent currently connect to.
    // VSTS-Node-Api will pick up proxy setting from azure-pipelines-task-lib automatically 
    let option: VsoBaseInterfaces.IRequestOptions = {
        proxy: {
                proxyUrl: proxy.proxyUrl,
                proxyUsername: proxy.proxyUsername,
                proxyPassword: proxy.proxyPassword,
                proxyBypassHosts: proxy.proxyBypassHosts
            },
            ignoreSslError: true
        };
    
    // Make a Rest call to VSTS/TFS
    let vsts: api.WebApi = new api.WebApi(serverUrl, authHandler, option);
    let connData: lim.ConnectionData = await vsts.connect();
    console.log('Hello ' + connData.authenticatedUser.providerDisplayName);

    // You can use the retrieved proxy config to call other services with Rest/Http client (like typed-rest-client or http.request) or even make raw http request using CURL with --proxy option.
}

run();
```

For some external applications executed from the shell, you might need to set an environment variable that contains a formatted URL 
in the following format: protocol://user:password@hostname:port
You can retrieve such configuration directly from task-lib: 
```typescript
import tl = require('azure-pipelines-task-lib/task');

async function run() {
    let proxy = tl.getProxyConfiguration()
    
    process.env['http_proxy'] = proxy.proxyFormattedUrl;
    process.env['https_proxy'] = proxy.proxyFormattedUrl;
    const gitPath: string = tl.which('git');
    const gitPull = tl.tool(gitPath);
    await gitPull.exec()
}

run();
```
#### PowerShell Lib

Method for retrieve proxy settings in PowerShell lib
``` powershell
function Get-WebProxy {
    [CmdletBinding()]
    param()

    # VstsTaskSdk.VstsWebProxy implement System.Net.IWebProxy interface
    Return New-Object -TypeName VstsTaskSdk.VstsWebProxy  
}
```

In the following example, we will retrieve proxy configuration information and make a raw http call to github.com first, then we will use PowerShell lib method to get `VssHttpClient` and make a Rest Api call back to VSTS/TFS service's `Project` endpoint and retrieve all team projects. Both raw http call and Rest call will go through the web proxy you configured in `.proxy` file.

```powershell
# retrieve proxy config
$proxy = Get-VstsWebProxy

Add-Type -Assembly System.Net.Http
$HttpClientHandler = New-Object System.Net.Http.HttpClientHandler
$HttpClientHandler.Proxy =  $proxy
$HttpClient = New-Object System.Net.Http.HttpClient -ArgumentList $HttpClientHandler

# make a raw http call to github.com
$HttpClient.GetAsync("https://www.github.com/microsoft/vsts-agent").Result

# get project http client (the client will have proxy hook up by default)
$projectHttpClient = Get-VstsVssHttpClient -TypeName Microsoft.TeamFoundation.Core.WebApi.ProjectHttpClient -OMDirectory "<Directory that contains required .dlls>"

# print out all team projects
$projectHttpClient.GetProjects().Result
```