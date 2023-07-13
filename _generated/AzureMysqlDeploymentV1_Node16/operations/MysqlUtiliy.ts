
import task = require('azure-pipelines-task-lib/task');
export class Utility {

    /**
     * Is name valid or not
     */
    public static isNameValid(name: string): boolean {
        if (name === null || name === undefined || typeof name.valueOf() !== 'string') {
            return false;
        }else{
            return true;
        }
    }

    /**
     * Get all the additional argumeent passed
     * @param argString  argument string 
     */
    public static getAdditionalArgumentForTelemtry(argString: string) : string[]{
        var args = [];
        var options = Utility.getMysqlOptions();
        options.forEach((option) => {
            var matched = argString.match(option);
            if(matched && matched.length > 0 ){
                args.push(option);
            }
        });
        task.debug("additional argument passed: "+ JSON.stringify(args));
        return args;
    }

    public static getMysqlOptions() : string []
    {
        return [
            "--auto-rehash",
            "--auto-vertical-output",
            "--batch",
            "-B",
            "--binary-as-hex",
            "-b",
            "--help",
            "--binary-mode",
            "--bind-address",
            "--character-sets-dir",
            "--column-names",
            "--column-type-info",
            "--comments",
            "-c",
            "--compress",
            "-C",
            "--connect-expired-password",
            "--database=db_name",
            "-D",
            "--debug[=debug_options]",
            "-#",
            "--debug-check",
            "--debug-info",
            "-T",
            "--default-auth",
            "--default-character-set",
            "--defaults-extra-file",
            "--defaults-file",
            "--defaults-group-suffix",
            "--delimiter",
            "--disable-named-commands",
            "--enable-cleartext-plugin",
            "--execute=statement",
            "-e",
            "--force",
            "-f",
            "--histignore",
            "--host=host_name",
            "-h",
            "--html",
            "-H",
            "--ignore-spaces",
            "-i",
            "--init-command",
            "--line-numbers",
            "--local-infile",
            "--login-path",
            "--named-commands",
            "-G",
            "--no-auto-rehash",
            "-A",
            "--no-beep",
            "-b",
            "--no-defaults",
            "--one-database",
            "-o",
            "--pager",
            "--password",
            "-p",
            "--pipe",
            "-W",
            "--plugin-dir",
            "--port",
            "-P",
            "--print-defaults",
            "--prompt",
            "--protocol",
            "--quick",
            "-q",
            "--raw",
            "-r",
            "--reconnect",
            "--safe-updates",
            "--i-am-a-dummy",
            "-U",
            "--secure-auth",
            "--server-public-key-path",
            "--shared-memory-base-name",
            "--show-warnings",
            "--sigint-ignore",
            "--silent",
            "-s",
            "--skip-column-names",
            "-N",
            "--skip-line-numbers",
            "-L",
            "--socket=path",
            "-S",
            "--ssl",
            "--syslog",
            "-j",
            "--table",
            "-t",
            "--tee",
            "--tls-version",
            "--unbuffered",
            "-n",
            "--user",
            "-u",
            "--verbose",
            "-v",
            "--version",
            "-V",
            "--vertical",
            "-E",
            "--wait",
            "-w",
            "--xml",
            "-X",
            "--connect_timeout",
            "--max_allowed_packet",
            "--max_join_size",
            "--net_buffer_length",
            "--select_limit"
        ]; 
    }

    public static argStringToArray(argString): string[] {
        var args = [];
        var inQuotes = false;
        var escaped = false;
        var arg = '';
        var append = function (c) {
            // we only escape double quotes.
            if (escaped && c !== '"') {
                arg += '\\';
            }
            arg += c;
            escaped = false;
        };
        for (var i = 0; i < argString.length; i++) {
            var c = argString.charAt(i);
            if (c === '"') {
                if (!escaped) {
                    inQuotes = !inQuotes;
                }
                else {
                    append(c);
                }
                continue;
            }
            if (c === "\\" && inQuotes) {
                if(escaped) {
                    append(c);
                }
                else {
                    escaped = true;
                }
    
                continue;
            }
            if (c === ' ' && !inQuotes) {
                if (arg.length > 0) {
                    args.push(arg);
                    arg = '';
                }
                continue;
            }
            append(c);
        }
        if (arg.length > 0) {
            args.push(arg.trim());
        }
        return args;
    }

}