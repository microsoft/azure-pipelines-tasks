import os = require('os');
import util = require('util');
import tl = require('azure-pipelines-task-lib/task');

// Sends all later console.log output through task-lib's external-output filter, which neutralizes and reports ##vso commands.
// A single-line message that starts with an allowed command is written unchanged: that is how libraries emit their own commands.
export function filterConsoleLog(source: tl.ExternalOutputOptions['source'], allowedVsoCommands: string[]): tl.ExternalOutputOptions {
    const options: tl.ExternalOutputOptions = { source, vsoCommandMode: 'blockAndTelemetry' };
    console.log = (...args: any[]) => {
        const message = util.format(...args);
        const isOwnCommand = !/[\r\n]/.test(message)
            && allowedVsoCommands.some(command => message.startsWith(`##vso[${command} `) || message.startsWith(`##vso[${command}]`));
        if (isOwnCommand) {
            process.stdout.write(message + os.EOL);
        } else {
            tl.writeExternalOutput(message + os.EOL, options);
        }
    };
    return options;
}
