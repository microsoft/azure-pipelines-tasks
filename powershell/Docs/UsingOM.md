# Using the Azure DevOps .NET SDKs

## Bundle the SDK with your task
Bundle the subset of the SDK required by your task.

***Do not use $(Agent.ServerOMDirectory).*** It is not safe for task authors to depend on the SDK bundled with the agent. Agent.ServerOMDirectory is a convenience variable that points to the latest SDK bundled with the agent. The SDK may have breaking interface changes between different versions. Depending on the latest version shipped with the agent will cause your task to be unreliable.

Newer SDKs talk to older servers (provided the functionality exists on the older server), and older SDKs talk to newer servers. For reliability, bundle your SDK dependencies with your task.

## Where to get the .NET SDKs

The .NET SDKs are available on [NuGet](https://www.nuget.org/profiles/nugetvss)

## Minimal set of DLLs required by your task

`Get-VstsAssemblyReference` can be used to walk an assembly's references to determine all of it's dependencies. Only a subset of the referenced assemblies may actually be required, depending on the functionality used by your task. It is best to bundle only the DLLs required for your scenario.

## Task SDK functions
Convenience functions are available for working with the .NET SDKs. The functions handle loading the required assemblies and constructing the client communication objects. See `Get-VstsTfsClientCredentials`, `Get-VstsTfsService`, `Get-VstsVssCredentials`, and `Get-VstsVssHttpClient` for more details.
