# AZURE-PIPELINES-TASK-LIB TYPESCRIPT API

## Dependencies
A [cross platform agent](https://github.com/Microsoft/vso-agent) OR a TFS 2015 Update 2 Windows agent (or higher) is required to run a Node task end-to-end. However, an agent is not required for interactively testing the task.

## Importing
For now, the built azure-pipelines-task-lib (in _build) should be packaged with your task in a node_modules folder

The build generates a azure-pipelines-task-lib.d.ts file for use when compiling tasks
In the example below, it is in a folder named definitions above the tasks lib

```
/// <reference path="../definitions/azure-pipelines-task-lib.d.ts" />
import tl = require('azure-pipelines-task-lib/task')
```

## [Release notes](releases.md)

<div id="index">

## Index

### Input Functions <a href="#InputFunctions">(v)</a>

<a href="#taskgetInput">getInput</a> <br/>
<a href="#taskgetInputRequired">getInputRequired</a> <br/>
<a href="#taskgetBoolInput">getBoolInput</a> <br/>
<a href="#taskgetPathInput">getPathInput</a> <br/>
<a href="#taskgetPathInputRequired">getPathInputRequired</a> <br/>
<a href="#taskfilePathSupplied">filePathSupplied</a> <br/>
<a href="#taskgetDelimitedInput">getDelimitedInput</a> <br/>
<a href="#taskgetVariable">getVariable</a> <br/>
<a href="#taskVariableInfo">VariableInfo</a> <br/>
<a href="#taskgetVariables">getVariables</a> <br/>
<a href="#tasksetVariable">setVariable</a> <br/>
<a href="#taskgetTaskVariable">getTaskVariable</a> <br/>
<a href="#tasksetTaskVariable">setTaskVariable</a> <br/>
<a href="#taskgetAgentMode">getAgentMode</a> <br/>

### Execution <a href="#Execution">(v)</a>

<a href="#tasktool">tool</a> <br/>
<a href="#toolrunnerToolRunnerarg">ToolRunner.arg</a> <br/>
<a href="#toolrunnerToolRunnerline">ToolRunner.line</a> <br/>
<a href="#toolrunnerToolRunnerargIf">ToolRunner.argIf</a> <br/>
<a href="#toolrunnerIExecOptions">IExecOptions</a> <br/>
<a href="#toolrunnerToolRunnerexec">ToolRunner.exec</a> <br/>
<a href="#toolrunnerToolRunnerexecSync">ToolRunner.execSync</a> <br/>
<a href="#toolrunnerToolRunnerpipeExecOutputToTool">ToolRunner.pipeExecOutputToTool</a> <br/>
<a href="#toolrunnerIExecSyncResult">IExecSyncResult</a> <br/>
<a href="#taskexec">exec</a> <br/>
<a href="#taskexecSync">execSync</a> <br/>
<a href="#tasksetResult">setResult</a> <br/>

### Service Connections <a href="#ServiceConnections">(v)</a>

<a href="#taskgetEndpointUrl">getEndpointUrl</a> <br/>
<a href="#taskgetEndpointUrlRequired">getEndpointUrlRequired</a> <br/>
<a href="#taskgetEndpointDataParameter">getEndpointDataParameter</a> <br/>
<a href="#taskgetEndpointDataParameterRequired">getEndpointDataParameterRequired</a> <br/>
<a href="#taskgetEndpointAuthorizationScheme">getEndpointAuthorizationScheme</a> <br/>
<a href="#taskgetEndpointAuthorizationSchemeRequired">getEndpointAuthorizationSchemeRequired</a> <br/>
<a href="#taskgetEndpointAuthorizationParameter">getEndpointAuthorizationParameter</a> <br/>
<a href="#taskgetEndpointAuthorizationParameterRequired">getEndpointAuthorizationParameterRequired</a> <br/>
<a href="#taskEndpointAuthorization">EndpointAuthorization</a> <br/>
<a href="#taskgetEndpointAuthorization">getEndpointAuthorization</a> <br/>

### Secrets <a href="#Secrets">(v)</a>

<a href="#tasksetSecret">setSecret</a> <br/>

### Secure Files <a href="#SecureFiles">(v)</a>

<a href="#taskgetSecureFileName">getSecureFileName</a> <br/>
<a href="#taskgetSecureFileTicket">getSecureFileTicket</a> <br/>

### Disk Functions <a href="#DiskFunctions">(v)</a>

<a href="#taskwhich">which</a> <br/>
<a href="#taskcheckPath">checkPath</a> <br/>
<a href="#taskexist">exist</a> <br/>
<a href="#taskcd">cd</a> <br/>
<a href="#taskcp">cp</a> <br/>
<a href="#taskmv">mv</a> <br/>
<a href="#taskmkdirP">mkdirP</a> <br/>
<a href="#taskFindOptions">FindOptions</a> <br/>
<a href="#taskfind">find</a> <br/>
<a href="#taskrmRF">rmRF</a> <br/>
<a href="#taskpushd">pushd</a> <br/>
<a href="#taskpopd">popd</a> <br/>
<a href="#taskresolve">resolve</a> <br/>
<a href="#taskstats">stats</a> <br/>
<a href="#taskwriteFile">writeFile</a> <br/>

### Globbing <a href="#Globbing">(v)</a>

<a href="#taskMatchOptions">MatchOptions</a> <br/>
<a href="#taskmatch">match</a> <br/>
<a href="#taskfindMatch">findMatch</a> <br/>
<a href="#taskfilter">filter</a> <br/>
<a href="#tasklegacyFindFiles">legacyFindFiles</a> <br/>

### Localization <a href="#Localization">(v)</a>

<a href="#tasksetResourcePath">setResourcePath</a> <br/>
<a href="#taskloc">loc</a> <br/>

### Proxy <a href="#Proxy">(v)</a>

<a href="#taskgetHttpProxyConfiguration">getHttpProxyConfiguration</a> <br/>

<br/>
<div id="InputFunctions">

## Input Functions

---

Functions for retrieving inputs for the task
<br/>
<div id="taskgetInput">

### task.getInput <a href="#index">(^)</a>
Gets the value of an input.  The value is also trimmed.
If required is true and the value is not set, it will throw.

@returns   string
```javascript
getInput(name:string, required?:boolean):string | undefined
```

Param | Type | Description
--- | --- | ---
name | string | name of the input to get
required | boolean | whether input is required.  optional, defaults to false

<br/>
<div id="taskgetInputRequired">

### task.getInputRequired <a href="#index">(^)</a>
Gets the value of an input.  The value is also trimmed.
If the value is not set, it will throw.

@returns   string
```javascript
getInputRequired(name:string):string
```

Param | Type | Description
--- | --- | ---
name | string | name of the input to get

<br/>
<div id="taskgetBoolInput">

### task.getBoolInput <a href="#index">(^)</a>
Gets the value of an input and converts to a bool.  Convenience.
If required is true and the value is not set, it will throw.

@returns   string
```javascript
getBoolInput(name:string, required?:boolean):boolean
```

Param | Type | Description
--- | --- | ---
name | string | name of the bool input to get
required | boolean | whether input is required.  optional, defaults to false

<br/>
<div id="taskgetPathInput">

### task.getPathInput <a href="#index">(^)</a>
Gets the value of a path input
It will be quoted for you if it isn't already and contains spaces
If required is true and the value is not set, it will throw.
If check is true and the path does not exist, it will throw.

@returns   string
```javascript
getPathInput(name:string, required?:boolean, check?:boolean):string | undefined
```

Param | Type | Description
--- | --- | ---
name | string | name of the input to get
required | boolean | whether input is required.  optional, defaults to false
check | boolean | whether path is checked.  optional, defaults to false

<br/>
<div id="taskgetPathInputRequired">

### task.getPathInputRequired <a href="#index">(^)</a>
Gets the value of a path input
It will be quoted for you if it isn't already and contains spaces
If the value is not set, it will throw.
If check is true and the path does not exist, it will throw.

@returns   string
```javascript
getPathInputRequired(name:string, check?:boolean):string
```

Param | Type | Description
--- | --- | ---
name | string | name of the input to get
check | boolean | whether path is checked.  optional, defaults to false

<br/>
<div id="taskfilePathSupplied">

### task.filePathSupplied <a href="#index">(^)</a>
Checks whether a path inputs value was supplied by the user
File paths are relative with a picker, so an empty path is the root of the repo.
Useful if you need to condition work (like append an arg) if a value was supplied

@returns   boolean
```javascript
filePathSupplied(name:string):boolean
```

Param | Type | Description
--- | --- | ---
name | string | name of the path input to check

<br/>
<div id="taskgetDelimitedInput">

### task.getDelimitedInput <a href="#index">(^)</a>
Gets the value of an input and splits the value using a delimiter (space, comma, etc).
Empty values are removed.  This function is useful for splitting an input containing a simple
list of items - such as build targets.
IMPORTANT: Do not use this function for splitting additional args!  Instead use argString(), which
follows normal argument splitting rules and handles values encapsulated by quotes.
If required is true and the value is not set, it will throw.

@returns   string[]
```javascript
getDelimitedInput(name:string, delim:string, required?:boolean):string[]
```

Param | Type | Description
--- | --- | ---
name | string | name of the input to get
delim | string | delimiter to split on
required | boolean | whether input is required.  optional, defaults to false

<br/>
<div id="taskgetVariable">

### task.getVariable <a href="#index">(^)</a>
Gets a variable value that is defined on the build/release definition or set at runtime.

@returns   string
```javascript
getVariable(name:string):string | undefined
```

Param | Type | Description
--- | --- | ---
name | string | name of the variable to get

<br/>
<div id="taskVariableInfo">

### task.VariableInfo <a href="#index">(^)</a>
Snapshot of a variable at the time when getVariables was called.

Property | Type | Description
--- | --- | ---
name | string |
value | string |
secret | boolean |

<br/>
<div id="taskgetVariables">

### task.getVariables <a href="#index">(^)</a>
Gets a snapshot of the current state of all job variables available to the task.
Requires a 2.104.1 agent or higher for full functionality.

Limitations on an agent prior to 2.104.1:
 1) The return value does not include all public variables. Only public variables
    that have been added using setVariable are returned.
 2) The name returned for each secret variable is the formatted environment variable
    name, not the actual variable name (unless it was set explicitly at runtime using
    setVariable).

@returns VariableInfo[]
```javascript
getVariables():VariableInfo[]
```

<br/>
<div id="taskgetAgentMode">

### task.getAgentMode <a href="#index">(^)</a>
Gets a agent hosted mode: Unknown, SelfHosted or MsHosted.
Requires a 2.212.0 agent or higher for full functionality. With lower version returns AgentHostedMode.Unknown value.

@returns AgentHostedMode
```javascript
getAgentMode():AgentHostedMode
```

<br/>
<div id="tasksetVariable">

### task.setVariable <a href="#index">(^)</a>
Sets a variable which will be available to subsequent tasks as well.

@returns   void
```javascript
setVariable(name:string, val:string, secret?:boolean):void
```

Param | Type | Description
--- | --- | ---
name | string | name of the variable to set
val | string | value to set
secret | boolean | whether variable is secret.  Multi\-line secrets are not allowed.  Optional, defaults to false

<br/>
<div id="taskgetTaskVariable">

### task.getTaskVariable <a href="#index">(^)</a>
Gets a variable value that is set by previous step from the same wrapper task.
Requires a 2.115.0 agent or higher.

@returns   string
```javascript
getTaskVariable(name:string):string | undefined
```

Param | Type | Description
--- | --- | ---
name | string | name of the variable to get

<br/>
<div id="tasksetTaskVariable">

### task.setTaskVariable <a href="#index">(^)</a>
Sets a task variable which will only be available to subsequent steps belong to the same wrapper task.
Requires a 2.115.0 agent or higher.

@returns   void
```javascript
setTaskVariable(name:string, val:string, secret?:boolean):void
```

Param | Type | Description
--- | --- | ---
name | string | name of the variable to set
val | string | value to set
secret | boolean | whether variable is secret.  optional, defaults to false


<br/>
<div id="Execution">

## Execution

---

Tasks typically execute a series of tools (cli) and set the result of the task based on the outcome of those

```javascript
/// <reference path="../definitions/azure-pipelines-task-lib.d.ts" />
import tl = require('azure-pipelines-task-lib/task');
import tr = require('azure-pipelines-task-lib/toolrunner');

try {
    var toolPath = tl.which('atool');
    var atool:tr.ToolRunner = tl.tool(toolPath).arg('--afile').line('arguments');
    var code: number = await atool.exec();
    console.log('rc=' + code);
}
catch (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
}
```
<br/>
<div id="tasktool">

### task.tool <a href="#index">(^)</a>
Convenience factory to create a ToolRunner.

@returns   ToolRunner
```javascript
tool(tool:string):ToolRunner
```

Param | Type | Description
--- | --- | ---
tool | string | path to tool to exec

<br/>
<div id="toolrunnerToolRunnerarg">

### toolrunner.ToolRunner.arg <a href="#index">(^)</a>
Add argument
Append an argument or an array of arguments
returns ToolRunner for chaining

@returns   ToolRunner
```javascript
arg(val:string | string[]):ToolRunner
```

Param | Type | Description
--- | --- | ---
val | string \| string\[\] | string cmdline or array of strings

<br/>
<div id="toolrunnerToolRunnerline">

### toolrunner.ToolRunner.line <a href="#index">(^)</a>
Parses an argument line into one or more arguments
e.g. .line('"arg one" two -z') is equivalent to .arg(['arg one', 'two', '-z'])
returns ToolRunner for chaining

@returns   ToolRunner
```javascript
line(val:string):ToolRunner
```

Param | Type | Description
--- | --- | ---
val | string | string argument line

<br/>
<div id="toolrunnerToolRunnerargIf">

### toolrunner.ToolRunner.argIf <a href="#index">(^)</a>
Add argument(s) if a condition is met
Wraps arg().  See arg for details
returns ToolRunner for chaining

@returns   ToolRunner
```javascript
argIf(condition:any, val:any):this
```

Param | Type | Description
--- | --- | ---
condition | any | boolean condition
val | any | string cmdline or array of strings

<br/>
<div id="toolrunnerIExecOptions">

### toolrunner.IExecOptions <a href="#index">(^)</a>
Interface for exec options

Property | Type | Description
--- | --- | ---
failOnStdErr | boolean | optional.  whether to fail if output to stderr.  defaults to false
ignoreReturnCode | boolean | optional.  defaults to failing on non zero.  ignore will not fail leaving it up to the caller

<br/>
<div id="toolrunnerToolRunnerexec">

### toolrunner.ToolRunner.exec <a href="#index">(^)</a>
Exec a tool.
Output will be streamed to the live console.
Returns promise with return code

@returns   number
```javascript
exec(options?:IExecOptions):any
```

Param | Type | Description
--- | --- | ---
options | IExecOptions | optional exec options.  See IExecOptions

<br/>
<div id="toolrunnerToolRunnerexecSync">

### toolrunner.ToolRunner.execSync <a href="#index">(^)</a>
Exec a tool synchronously.
Output will be *not* be streamed to the live console.  It will be returned after execution is complete.
Appropriate for short running tools
Returns IExecSyncResult with output and return code

@returns   IExecSyncResult
```javascript
execSync(options?:IExecSyncOptions):IExecSyncResult
```

Param | Type | Description
--- | --- | ---
options | IExecSyncOptions | optional exec options.  See IExecSyncOptions

<br/>
<div id="toolrunnerToolRunnerpipeExecOutputToTool">

### toolrunner.ToolRunner.pipeExecOutputToTool <a href="#index">(^)</a>
Pipe output of exec() to another tool
@returns {ToolRunner}
```javascript
pipeExecOutputToTool(tool:ToolRunner, file?:string):ToolRunner
```

Param | Type | Description
--- | --- | ---
tool | ToolRunner |
file | string | optional filename to additionally stream the output to.

<br/>
<div id="toolrunnerIExecSyncResult">

### toolrunner.IExecSyncResult <a href="#index">(^)</a>
Interface for exec results returned from synchronous exec functions

Property | Type | Description
--- | --- | ---
stdout | string | standard output
stderr | string | error output
code | number | return code
error | Error | Error on failure

<br/>
<div id="taskexec">

### task.exec <a href="#index">(^)</a>
Exec a tool.  Convenience wrapper over ToolRunner to exec with args in one call.
Output will be streamed to the live console.
Returns promise with return code

@returns   number
```javascript
exec(tool:string, args:any, options?:IExecOptions):any
```

Param | Type | Description
--- | --- | ---
tool | string | path to tool to exec
args | any | an arg string or array of args
options | IExecOptions | optional exec options.  See IExecOptions

<br/>
<div id="taskexecSync">

### task.execSync <a href="#index">(^)</a>
Exec a tool synchronously.  Convenience wrapper over ToolRunner to execSync with args in one call.
Output will be *not* be streamed to the live console.  It will be returned after execution is complete.
Appropriate for short running tools
Returns IExecResult with output and return code

@returns   IExecSyncResult
```javascript
execSync(tool:string, args:string | string[], options?:IExecSyncOptions):IExecSyncResult
```

Param | Type | Description
--- | --- | ---
tool | string | path to tool to exec
args | string \| string\[\] | an arg string or array of args
options | IExecSyncOptions | optional exec options.  See IExecSyncOptions

<br/>
<div id="tasksetResult">

### task.setResult <a href="#index">(^)</a>
Sets the result of the task.
Execution will continue.
If not set, task will be Succeeded.
If multiple calls are made to setResult the most pessimistic call wins (Failed) regardless of the order of calls.

@returns         void
```javascript
setResult(result:TaskResult, message:string):void
```

Param | Type | Description
--- | --- | ---
result | TaskResult | TaskResult enum of Succeeded, SucceededWithIssues or Failed.
message | string | A message which will be logged as an error issue if the result is Failed.


<br/>
<div id="ServiceConnections">

## Service Connections

---

Retrieve service connections (previously called "service endpoints") and authorization details
<br/>
<div id="taskgetEndpointUrl">

### task.getEndpointUrl <a href="#index">(^)</a>
Gets the url for a service endpoint
If the url was not set and is not optional, it will throw.

@returns   string
```javascript
getEndpointUrl(id:string, optional:boolean):string | undefined
```

Param | Type | Description
--- | --- | ---
id | string | name of the service endpoint
optional | boolean | whether the url is optional

<br/>
<div id="taskgetEndpointUrlRequired">

### task.getEndpointUrlRequired <a href="#index">(^)</a>
Gets the url for a service endpoint
If the url was not set, it will throw.

@returns   string
```javascript
getEndpointUrlRequired(id:string):string
```

Param | Type | Description
--- | --- | ---
id | string | name of the service endpoint

<br/>
<div id="taskgetEndpointDataParameter">

### task.getEndpointDataParameter <a href="#index">(^)</a>
```javascript
getEndpointDataParameter(id:string, key:string, optional:boolean):string | undefined
```

Param | Type | Description
--- | --- | ---
id | string |
key | string |
optional | boolean |

<br/>
<div id="taskgetEndpointDataParameterRequired">

### task.getEndpointDataParameterRequired <a href="#index">(^)</a>
```javascript
getEndpointDataParameterRequired(id:string, key:string):string
```

Param | Type | Description
--- | --- | ---
id | string |
key | string |

<br/>
<div id="taskgetEndpointAuthorizationScheme">

### task.getEndpointAuthorizationScheme <a href="#index">(^)</a>
Gets the endpoint authorization scheme for a service endpoint
If the endpoint authorization scheme is not set and is not optional, it will throw.

@returns {string} value of the endpoint authorization scheme
```javascript
getEndpointAuthorizationScheme(id:string, optional:boolean):string | undefined
```

Param | Type | Description
--- | --- | ---
id | string | name of the service endpoint
optional | boolean | whether the endpoint authorization scheme is optional

<br/>
<div id="taskgetEndpointAuthorizationSchemeRequired">

### task.getEndpointAuthorizationSchemeRequired <a href="#index">(^)</a>
Gets the endpoint authorization scheme for a service endpoint
If the endpoint authorization scheme is not set, it will throw.

@returns {string} value of the endpoint authorization scheme
```javascript
getEndpointAuthorizationSchemeRequired(id:string):string
```

Param | Type | Description
--- | --- | ---
id | string | name of the service endpoint

<br/>
<div id="taskgetEndpointAuthorizationParameter">

### task.getEndpointAuthorizationParameter <a href="#index">(^)</a>
Gets the endpoint authorization parameter value for a service endpoint with specified key
If the endpoint authorization parameter is not set and is not optional, it will throw.

@returns {string} value of the endpoint authorization parameter value
```javascript
getEndpointAuthorizationParameter(id:string, key:string, optional:boolean):string | undefined
```

Param | Type | Description
--- | --- | ---
id | string | name of the service endpoint
key | string | key to find the endpoint authorization parameter
optional | boolean | optional whether the endpoint authorization scheme is optional

<br/>
<div id="taskgetEndpointAuthorizationParameterRequired">

### task.getEndpointAuthorizationParameterRequired <a href="#index">(^)</a>
Gets the endpoint authorization parameter value for a service endpoint with specified key
If the endpoint authorization parameter is not set, it will throw.

@returns {string} value of the endpoint authorization parameter value
```javascript
getEndpointAuthorizationParameterRequired(id:string, key:string):string
```

Param | Type | Description
--- | --- | ---
id | string | name of the service endpoint
key | string | key to find the endpoint authorization parameter

<br/>
<div id="taskEndpointAuthorization">

### task.EndpointAuthorization <a href="#index">(^)</a>
Interface for EndpointAuthorization
Contains a schema and a string/string dictionary of auth data

Property | Type | Description
--- | --- | ---
parameters | \{ \[key: string\]: string; \} | dictionary of auth data
scheme | string | auth scheme such as OAuth or username/password etc...

<br/>
<div id="taskgetEndpointAuthorization">

### task.getEndpointAuthorization <a href="#index">(^)</a>
Gets the authorization details for a service endpoint
If the authorization was not set and is not optional, it will set the task result to Failed.

@returns   string
```javascript
getEndpointAuthorization(id:string, optional:boolean):EndpointAuthorization
```

Param | Type | Description
--- | --- | ---
id | string | name of the service endpoint
optional | boolean | whether the url is optional


<br/>
<div id="Secrets">

## Secrets

---

Functions for managing pipeline secrets
<br/>
<div id="tasksetSecret">

### task.setSecret <a href="#index">(^)</a>
Registers a value with the logger, so the value will be masked from the logs.  Multi-line secrets are not allowed.
```javascript
setSecret(val:string):void
```

Param | Type | Description
--- | --- | ---
val | string | value to register


<br/>
<div id="SecureFiles">

## Secure Files

---

Retrieve secure files details required to download the file
<br/>
<div id="taskgetSecureFileName">

### task.getSecureFileName <a href="#index">(^)</a>
Gets the name for a secure file

@returns   string
```javascript
getSecureFileName(id:string):string
```

Param | Type | Description
--- | --- | ---
id | string | secure file id

<br/>
<div id="taskgetSecureFileTicket">

### task.getSecureFileTicket <a href="#index">(^)</a>
Gets the secure file ticket that can be used to download the secure file contents

@returns {string} secure file ticket
```javascript
getSecureFileTicket(id:string):string
```

Param | Type | Description
--- | --- | ---
id | string | name of the secure file


<br/>
<div id="DiskFunctions">

## Disk Functions

---

Functions for disk operations
<br/>
<div id="taskwhich">

### task.which <a href="#index">(^)</a>
Returns path of a tool had the tool actually been invoked.  Resolves via paths.
If you check and the tool does not exist, it will throw.

@returns   string
```javascript
which(tool:string, check?:boolean):string
```

Param | Type | Description
--- | --- | ---
tool | string | name of the tool
check | boolean | whether to check if tool exists

<br/>
<div id="taskcheckPath">

### task.checkPath <a href="#index">(^)</a>
Checks whether a path exists.
If the path does not exist, it will throw.

@returns   void
```javascript
checkPath(p:string, name:string):void
```

Param | Type | Description
--- | --- | ---
p | string | path to check
name | string | name only used in error message to identify the path

<br/>
<div id="taskexist">

### task.exist <a href="#index">(^)</a>
Returns whether a path exists.

@returns   boolean
```javascript
exist(path:string):boolean
```

Param | Type | Description
--- | --- | ---
path | string | path to check

<br/>
<div id="taskcd">

### task.cd <a href="#index">(^)</a>
Change working directory.

@returns   void
```javascript
cd(path:string):void
```

Param | Type | Description
--- | --- | ---
path | string | new working directory path

<br/>
<div id="taskcp">

### task.cp <a href="#index">(^)</a>
Copies a file or folder.
```javascript
cp(source:string, dest:string, options?:string, continueOnError?:boolean):void
```

Param | Type | Description
--- | --- | ---
source | string | source path
dest | string | destination path
options | string | string \-r, \-f or \-rf for recursive and force
continueOnError | boolean | optional. whether to continue on error
retryCount | number | optional. Retry count to copy the file. It might help to resolve intermittent issues e.g. with UNC target paths on a remote host.

<br/>
<div id="taskmv">

### task.mv <a href="#index">(^)</a>
Moves a path.
```javascript
mv(source:string, dest:string, options?:string, continueOnError?:boolean):void
```

Param | Type | Description
--- | --- | ---
source | string | source path
dest | string | destination path
options | string | string \-f or \-n for force and no clobber
continueOnError | boolean | optional. whether to continue on error

<br/>
<div id="taskmkdirP">

### task.mkdirP <a href="#index">(^)</a>
Make a directory.  Creates the full path with folders in between
Will throw if it fails

@returns   void
```javascript
mkdirP(p:string):void
```

Param | Type | Description
--- | --- | ---
p | string | path to create

<br/>
<div id="taskFindOptions">

### task.FindOptions <a href="#index">(^)</a>
Interface for FindOptions
Contains properties to control whether to follow symlinks

Property | Type | Description
--- | --- | ---
allowBrokenSymbolicLinks | boolean | When true, broken symbolic link will not cause an error.
followSpecifiedSymbolicLink | boolean | Equivalent to the \-H command line option. Indicates whether to traverse descendants if the specified path is a symbolic link directory. Does not cause nested symbolic link directories to be traversed.
followSymbolicLinks | boolean | Equivalent to the \-L command line option. Indicates whether to traverse descendants of symbolic link directories.

<br/>
<div id="taskfind">

### task.find <a href="#index">(^)</a>
Recursively finds all paths a given path. Returns an array of paths.

@returns   string[]
```javascript
find(findPath:string, options?:FindOptions):string[]
```

Param | Type | Description
--- | --- | ---
findPath | string | path to search
options | FindOptions | optional. defaults to \{ followSymbolicLinks: true \}. following soft links is generally appropriate unless deleting files.

<br/>
<div id="taskrmRF">

### task.rmRF <a href="#index">(^)</a>
Remove a path recursively with force
Returns whether it succeeds

@returns   void
```javascript
rmRF(path:string):void
```

Param | Type | Description
--- | --- | ---
path | string | path to remove

<br/>
<div id="taskpushd">

### task.pushd <a href="#index">(^)</a>
Change working directory and push it on the stack

@returns   void
```javascript
pushd(path:string):void
```

Param | Type | Description
--- | --- | ---
path | string | new working directory path

<br/>
<div id="taskpopd">

### task.popd <a href="#index">(^)</a>
Change working directory back to previously pushed directory

@returns   void
```javascript
popd():void
```

<br/>
<div id="taskresolve">

### task.resolve <a href="#index">(^)</a>
Resolves a sequence of paths or path segments into an absolute path.
Calls node.js path.resolve()
Allows L0 testing with consistent path formats on Mac/Linux and Windows in the mock implementation
@returns {string}
```javascript
resolve(pathSegments:any[]):string
```

Param | Type | Description
--- | --- | ---
pathSegments | any\[\] |

<br/>
<div id="taskstats">

### task.stats <a href="#index">(^)</a>
Get's stat on a path.
Useful for checking whether a file or directory.  Also getting created, modified and accessed time.
see [fs.stat](https://nodejs.org/api/fs.html#fs_class_fs_stats)

@returns   fsStat
```javascript
stats(path:string):FsStats
```

Param | Type | Description
--- | --- | ---
path | string | path to check

<br/>
<div id="taskwriteFile">

### task.writeFile <a href="#index">(^)</a>
```javascript
writeFile(file:string, data:any, options?:string | FsOptions):void
```

Param | Type | Description
--- | --- | ---
file | string |
data | any |
options | string \| FsOptions |


<br/>
<div id="Globbing">

## Globbing

---

Functions for matching file paths
<br/>
<div id="taskMatchOptions">

### task.MatchOptions <a href="#index">(^)</a>

Property | Type | Description
--- | --- | ---
debug | boolean |
nobrace | boolean |
noglobstar | boolean |
dot | boolean |
noext | boolean |
nocase | boolean |
nonull | boolean |
matchBase | boolean |
nocomment | boolean |
nonegate | boolean |
flipNegate | boolean |

<br/>
<div id="taskmatch">

### task.match <a href="#index">(^)</a>
Applies glob patterns to a list of paths. Supports interleaved exclude patterns.
```javascript
match(list:string[], patterns:string[] | string, patternRoot?:string, options?:MatchOptions):string[]
```

Param | Type | Description
--- | --- | ---
list | string\[\] | array of paths
patterns | string\[\] \| string | patterns to apply. supports interleaved exclude patterns.
patternRoot | string | optional. default root to apply to unrooted patterns. not applied to basename\-only patterns when matchBase:true.
options | MatchOptions | optional. defaults to \{ dot: true, nobrace: true, nocase: process.platform == 'win32' \}.

<br/>
<div id="taskfindMatch">

### task.findMatch <a href="#index">(^)</a>
Determines the find root from a list of patterns. Performs the find and then applies the glob patterns.
Supports interleaved exclude patterns. Unrooted patterns are rooted using defaultRoot, unless
matchOptions.matchBase is specified and the pattern is a basename only. For matchBase cases, the
defaultRoot is used as the find root.
```javascript
findMatch(defaultRoot:string, patterns:string[] | string, findOptions?:FindOptions, matchOptions?:MatchOptions):string[]
```

Param | Type | Description
--- | --- | ---
defaultRoot | string | default path to root unrooted patterns. falls back to System.DefaultWorkingDirectory or process.cwd\(\).
patterns | string\[\] \| string | pattern or array of patterns to apply
findOptions | FindOptions | defaults to \{ followSymbolicLinks: true \}. following soft links is generally appropriate unless deleting files.
matchOptions | MatchOptions | defaults to \{ dot: true, nobrace: true, nocase: process.platform == 'win32' \}

<br/>
<div id="taskfilter">

### task.filter <a href="#index">(^)</a>
Filter to apply glob patterns
```javascript
filter(pattern:string, options?:MatchOptions):(element: string, indexed: number, array: string[]) => boolean
```

Param | Type | Description
--- | --- | ---
pattern | string | pattern to apply
options | MatchOptions | optional. defaults to \{ dot: true, nobrace: true, nocase: process.platform == 'win32' \}.

<br/>
<div id="tasklegacyFindFiles">

### task.legacyFindFiles <a href="#index">(^)</a>
Prefer tl.find() and tl.match() instead. This function is for backward compatibility
when porting tasks to Node from the PowerShell or PowerShell3 execution handler.

@returns  string[]
```javascript
legacyFindFiles(rootDirectory:string, pattern:string, includeFiles?:boolean, includeDirectories?:boolean):string[]
```

Param | Type | Description
--- | --- | ---
rootDirectory | string | path to root unrooted patterns with
pattern | string | include and exclude patterns
includeFiles | boolean | whether to include files in the result. defaults to true when includeFiles and includeDirectories are both false
includeDirectories | boolean | whether to include directories in the result


<br/>
<div id="Localization">

## Localization

---

Localization is optional but is supported using these functions at runtime

```javascript
/// <reference path="../definitions/azure-pipelines-task-lib.d.ts" />

tl.setResourcePath(path.join( __dirname, 'task.json'));

...

var errMsg = tl.loc('FailedWithReturnCode', code));

// in the task.json
{
    "messages": {
        "FailedWithReturnCode": "Tool exited with return code: %d",
        "ToolFailed": "Tool failed with error: %s"
    }
}
```
<br/>
<div id="tasksetResourcePath">

### task.setResourcePath <a href="#index">(^)</a>
Sets the location of the resources json.  This is typically the task.json file.
Call once at the beginning of the script before any calls to loc.

@returns   void
```javascript
setResourcePath(path:string):void
```

Param | Type | Description
--- | --- | ---
path | string | Full path to the json.

<br/>
<div id="taskloc">

### task.loc <a href="#index">(^)</a>
Gets the localized string from the json resource file.  Optionally formats with additional params.

@returns   string
```javascript
loc(key:string, param:any[]):string
```

Param | Type | Description
--- | --- | ---
key | string | key of the resources string in the resource file
param | any\[\] | additional params for formatting the string


<br/>
<div id="Proxy">

## Proxy

---

Funtions for web proxy settings
<br/>
<div id="taskgetHttpProxyConfiguration">

### task.getHttpProxyConfiguration <a href="#index">(^)</a>
Gets http proxy configuration used by Build/Release agent

@return  ProxyConfiguration
```javascript
getHttpProxyConfiguration(requestUrl?:string):ProxyConfiguration
```

Param | Type | Description
--- | --- | ---
requestUrl | string |

