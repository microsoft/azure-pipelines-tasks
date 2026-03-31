import * as telemetry from "azure-pipelines-tasks-utility-common/telemetry";
import * as tl from "azure-pipelines-task-lib";

export function logUniversalStartupVariables(artifactToolPath: string) {
    try {
        let universalPackagesTelemetry = {
            "command": tl.getInput("command"),
            "buildProperties": tl.getInput("buildProperties"),
            "basePath": tl.getInput("basePath"),
            "System.TeamFoundationCollectionUri": tl.getVariable("System.TeamFoundationCollectionUri"),
            "verbosity": tl.getInput("verbosity"),
            "solution": tl.getInput("solution"),
            "artifactToolPath": artifactToolPath,
            "artifactToolOverride": tl.getVariable("artifactToolOverride"),
        };

        telemetry.emitTelemetry("Packaging", "UniversalPackages", universalPackagesTelemetry);
    } catch (err) {
        tl.debug(`Unable to log Universal Packages task init telemetry. Err:( ${err} )`);
    }
}
