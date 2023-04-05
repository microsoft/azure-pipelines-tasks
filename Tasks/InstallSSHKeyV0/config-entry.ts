const os = require('os');

/**
 * Represents SSH configuration file entry.
 */
export class ConfigFileEntry {
    public constructor(
        private alias:string, 
        private hostName: string, 
        private user: string, 
        private identityFile: string, 
        private port: string) { }

    public toString(): string {
        let result: string = '';
        result += `Host ${this.alias}${os.EOL}`;
        result += `HostName ${this.hostName}${os.EOL}`;
        result += `IdentityFile "${this.identityFile}"${os.EOL}`;

        if (this.user) {
            result += `User "${this.user}"${os.EOL}`;
        }
        if (this.port) {
            result += `Port ${this.port}${os.EOL}`;
        }
        return result;
    }
}