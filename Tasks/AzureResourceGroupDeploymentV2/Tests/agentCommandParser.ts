// A faithful port of the agent's own logging command parser, so the tests assert against
// the behaviour the agent actually applies at runtime.
//
// azure-pipelines-task-lib ships commandFromString(), but it is a test helper rather than a
// model of the agent and differs in ways that matter here: it throws on a malformed property
// where the agent silently skips it, and it searches for the closing bracket from the start
// of the string rather than from the marker.
//
// Ported from microsoft/azure-pipelines-agent:
//   src/Microsoft.VisualStudio.Services.Agent/Command.cs  - Command.TryParse
//   src/Agent.Sdk/CommandStringConvertor.cs               - CommandStringConvertor.Unescape

const LOGGING_COMMAND_PREFIX = '##vso[';

// Mirrors _specialSymbolsMapping, in the same order the agent applies it.
const specialSymbolsMapping: Array<[string, string]> = [
    [';', '%3B'],
    ['\r', '%0D'],
    ['\n', '%0A'],
    [']', '%5D']
];

function unescape(escaped: string, unescapePercents: boolean): string {
    if (!escaped) {
        return '';
    }
    let unescaped = escaped;
    for (const mapping of specialSymbolsMapping) {
        unescaped = unescaped.split(mapping[1]).join(mapping[0]);
    }
    if (unescapePercents) {
        unescaped = unescaped.split('%AZP25').join('%');
    }
    return unescaped;
}

export interface AgentCommand {
    area: string;
    event: string;
    properties: { [key: string]: string };
    data: string;
}

/**
 * Parses a single line the way the agent does, returning null when the agent would not
 * recognise a command. The marker is located with an index-of match, so it is honoured
 * anywhere on the line and not only at the start.
 */
export function tryParseAgentCommand(message: string, unescapePercents: boolean = true): AgentCommand | null {
    if (!message) {
        return null;
    }

    const prefixIndex = message.indexOf(LOGGING_COMMAND_PREFIX);
    if (prefixIndex < 0) {
        return null;
    }

    const rbIndex = message.indexOf(']', prefixIndex);
    if (rbIndex < 0) {
        return null;
    }

    const cmdIndex = prefixIndex + LOGGING_COMMAND_PREFIX.length;
    const cmdInfo = message.substring(cmdIndex, rbIndex);

    const spaceIndex = cmdInfo.indexOf(' ');
    const commandName = spaceIndex < 0 ? cmdInfo : cmdInfo.substring(0, spaceIndex);

    // The agent requires exactly area.event, so anything else is not a command.
    const areaEvent = commandName.split('.').filter(part => part.length > 0);
    if (areaEvent.length !== 2) {
        return null;
    }

    const properties: { [key: string]: string } = {};
    if (spaceIndex > 0) {
        const propertiesStr = cmdInfo.substring(spaceIndex + 1);
        for (const propertyStr of propertiesStr.split(';').filter(part => part.length > 0)) {
            const equalsIndex = propertyStr.indexOf('=');
            // The agent splits into at most two non-empty parts, so a property with no name
            // or no value is skipped rather than treated as an error.
            if (equalsIndex > 0 && equalsIndex < propertyStr.length - 1) {
                properties[propertyStr.substring(0, equalsIndex)] =
                    unescape(propertyStr.substring(equalsIndex + 1), unescapePercents);
            }
        }
    }

    return {
        area: areaEvent[0],
        event: areaEvent[1],
        properties: properties,
        data: unescape(message.substring(rbIndex + 1), unescapePercents)
    };
}

/**
 * Parses every line of captured stdout the way the agent would, returning the commands it
 * would actually have executed.
 */
export function parseAgentCommands(stdout: string): AgentCommand[] {
    return stdout
        .split(/\r?\n/)
        .map(line => tryParseAgentCommand(line))
        .filter(cmd => !!cmd);
}
