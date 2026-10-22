# External output logging

`Protect-ExternalOutput` keeps its shared default, `blockOnly`, for existing consumers.
Callers can explicitly select `disabled`, `telemetryOnly`, `blockOnly`, or
`blockAndTelemetry` with `-VsoCommandMode`. Telemetry is written to the Information
stream, not the returned filename value. It records source, command name, and blocking
status, not the command payload.

The filename diagnostics in ServiceFabricDeployV1, ServiceFabricComposeDeployV0,
ServiceFabricUpdateManifestsV2, and AzureCloudPowerShellDeploymentV1/V2 explicitly use
the pipeline feature `EnableVsoCommandBlockingRMTasks`: true selects
`blockAndTelemetry`; false or unset selects `telemetryOnly`. This does not change the
shared default for other tasks. Only displayed filenames are processed; raw filesystem
and deployment arguments and task-owned command prefixes remain unchanged.

ServiceFabricUpdateManifestsV2 packages VstsTaskSdk 0.11, which predates
`Get-VstsPipelineFeature`. It reads the same `DistributedTask.Tasks` variable through
`Get-VstsTaskVariable -AsBool` when that helper is unavailable.

The shared implementation and encoding/mode tests are aligned with
microsoft/azure-pipelines-tasks#22726 at
`78e06234251ed636fd60aba0d8760d08fa43b7d7`. That PR also changes the
ServiceFabricUpdateManifestsV2 version; coordinate the final version at merge time
rather than incrementing the current unreleased version twice.

FileTransformV1/V2 alignment remains deferred until common-package PR683 is published;
no unpublished package version is referenced here.
