import tl = require("azure-pipelines-task-lib/task");

// The safe logging command format relies on the agent decoding the %AZP25 escape sequence that
// azure-pipelines-task-lib emits for a literal '%'. The agent learned the sequence in 2.182.0 but
// only began decoding it by default in 2.184.0, so 2.184.0 is the lowest version on which an output
// name or value containing '%' round-trips unchanged.
export const minimumAgentVersionForSafeOutputVariables: string = "2.184.0";

const decodePercentsVariableName: string = "DECODE_PERCENTS";

function parseVersion(value: string | null | undefined): number[] | null {
    if (!value) {
        return null;
    }

    const core = value.trim().split("-")[0].split("+")[0];
    const parts = core.split(".");
    if (core.length === 0 || parts.length > 4) {
        return null;
    }

    const parsed: number[] = [];
    for (const part of parts) {
        if (!/^\d+$/.test(part)) {
            return null;
        }
        parsed.push(parseInt(part, 10));
    }

    while (parsed.length < 3) {
        parsed.push(0);
    }

    return parsed;
}

export function isAtLeastVersion(actual: string | null | undefined, minimum: string): boolean {
    const actualParts = parseVersion(actual);
    const minimumParts = parseVersion(minimum);
    if (!actualParts || !minimumParts) {
        return false;
    }

    for (let index = 0; index < 3; index++) {
        if (actualParts[index] > minimumParts[index]) {
            return true;
        }
        if (actualParts[index] < minimumParts[index]) {
            return false;
        }
    }

    return true;
}

// Mirrors StringUtil.ConvertToBoolean in the agent, which treats any value it does not recognise
// as false. A variable set to something like "yes" therefore disables decoding.
function convertToBoolean(value: string): boolean {
    switch (value.trim().toLowerCase()) {
        case "1":
        case "true":
        case "$true":
            return true;
        default:
            return false;
    }
}

export function isPercentDecodingDisabled(): boolean {
    // The agent resolves this knob from the job variables first and the environment second.
    const configuredValues = [tl.getVariable(decodePercentsVariableName), process.env[decodePercentsVariableName]];
    for (const configured of configuredValues) {
        if (configured !== undefined && configured !== null && configured.trim() !== "") {
            return !convertToBoolean(configured);
        }
    }

    // Unset on a supported agent means the built-in default, which decodes.
    return false;
}

// Decides whether deployment outputs can be published using the safe logging command format.
// An agent that cannot decode the escaping would hand the caller a corrupted name or value, so the
// task keeps the previous format there and reports why. Callers are expected to have confirmed that
// the feature is enabled before asking.
export function canEmitSafeOutputVariables(): boolean {
    const agentVersion = tl.getVariable("Agent.Version");
    const agentIsSupported = isAtLeastVersion(agentVersion, minimumAgentVersionForSafeOutputVariables);
    const percentDecodingDisabled = isPercentDecodingDisabled();
    const canEmit = agentIsSupported && !percentDecodingDisabled;

    if (!canEmit) {
        tl.warning(agentIsSupported
            ? tl.loc("SafeOutputVariablesPercentDecodingDisabled", decodePercentsVariableName)
            : tl.loc(
                "SafeOutputVariablesAgentTooOld",
                agentVersion && agentVersion.trim() !== "" ? agentVersion : "unknown",
                minimumAgentVersionForSafeOutputVariables));
    }

    return canEmit;
}
