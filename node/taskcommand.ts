//
// Command Format:
//    ##vso[artifact.command key=value;key=value]user message
//    
// Examples:
//    ##vso[task.progress value=58]
//    ##vso[task.issue type=warning;]This is the user warning message
//
let CMD_PREFIX = '##vso[';

export class TaskCommand {
    constructor(command, properties, message) {
        if (!command) {
            command = 'missing.command';
        }

        this.command = command;
        this.properties = properties;
        this.message = message;
    }

    public command: string;
    public message: string;
    public properties: {[key: string]: string};

    public toString() {
        var cmdStr = CMD_PREFIX + this.command;

        if (this.properties && Object.keys(this.properties).length > 0) {
            cmdStr += ' ';
            for (var key in this.properties) {
                if (this.properties.hasOwnProperty(key)) {
                    var val = this.properties[key];
                    if (val) {
                        // safely append the val - avoid blowing up when attempting to
                        // call .replace() if message is not a string for some reason
                        cmdStr += key + '=' + escape('' + (val || '')) + ';';
                    }
                }
            }
        }

        cmdStr += ']';

        // safely append the message - avoid blowing up when attempting to
        // call .replace() if message is not a string for some reason
        let message: string = '' + (this.message || '');
        cmdStr += escapedata(message);

        return cmdStr;
    }
}

export function commandFromString(commandLine) {
    var preLen = CMD_PREFIX.length;
    var lbPos = commandLine.indexOf('[');
    var rbPos = commandLine.indexOf(']');
    if (lbPos == -1 || rbPos == -1 || rbPos - lbPos < 3) {
        throw new Error('Invalid command brackets');
    }
    var cmdInfo = commandLine.substring(lbPos + 1, rbPos);
    var spaceIdx = cmdInfo.indexOf(' ');

    var command = cmdInfo;
    var properties = {};

    if (spaceIdx > 0) {
        command = cmdInfo.trim().substring(0, spaceIdx);
        var propSection = cmdInfo.trim().substring(spaceIdx+1);

        var propLines: string[] = propSection.split(';');
        propLines.forEach(function (propLine: string) {
            propLine = propLine.trim();
            if (propLine.length > 0) {
                var eqIndex = propLine.indexOf('=');
                if (eqIndex == -1){
                    throw new Error('Invalid property: ' + propLine);
                }

                var key: string = propLine.substring(0, eqIndex);
                var val: string = propLine.substring(eqIndex+1);

                properties[key] = unescape(val);
            }
        });
    }

    let msg: string = unescapedata(commandLine.substring(rbPos + 1));
    var cmd = new TaskCommand(command, properties, msg);
    return cmd;
}

function escapedata(s) : string {
    return s.replace(/%/g, '%AZP25')
            .replace(/\r/g, '%0D')
            .replace(/\n/g, '%0A');
}

function unescapedata(s) : string {
    return s.replace(/%0D/g, '\r')
            .replace(/%0A/g, '\n')
            .replace(/%AZP25/g, '%');
}

function escape(s) : string {
    return s.replace(/%/g, '%AZP25')
            .replace(/\r/g, '%0D')
            .replace(/\n/g, '%0A')
            .replace(/]/g, '%5D')
            .replace(/;/g, '%3B');
}

function unescape(s) : string {
    return s.replace(/%0D/g, '\r')
            .replace(/%0A/g, '\n')
            .replace(/%5D/g, ']')
            .replace(/%3B/g, ';')
            .replace(/%AZP25/g, '%');
}
