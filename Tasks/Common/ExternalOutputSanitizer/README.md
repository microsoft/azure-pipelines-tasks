# External output logging

`Protect-ExternalOutput` keeps its shared default, `blockOnly`, for existing consumers.
Callers can explicitly select `disabled`, `telemetryOnly`, `blockOnly`, or
`blockAndTelemetry` with `-VsoCommandMode`. Telemetry is written to the Information
stream, not the returned filename value. It records source, command name, and blocking
status, not the command payload.

The filename diagnostics in ServiceFabricDeployV1, ServiceFabricComposeDeployV0,
and AzureCloudPowerShellDeploymentV1/V2 explicitly use
the pipeline feature `EnableVsoCommandBlockingRMTasks`: true selects
`blockAndTelemetry`; false or unset selects `telemetryOnly`. This does not change the
shared default for other tasks. Only displayed filenames are processed; raw filesystem
and deployment arguments and task-owned command prefixes remain unchanged.

ServiceFabricUpdateManifestsV2 retains the always-blocking calls and command
restrictions already on master. Its diagnostics are not gated by this feature.

The shared implementation and encoding/mode tests preserve the upstream changes
from microsoft/azure-pipelines-tasks#22726, including existing consumer protection
and version updates.

FileTransformV1/V2 consume published `azure-pipelines-tasks-webdeployment-common`
4.282.1 or later and explicitly pass the same feature-selected mode on folder and
archive paths. The XDT compatibility gate remains independent and unchanged.
Inherited XDT tool command echo is outside this filename diagnostics scope.
