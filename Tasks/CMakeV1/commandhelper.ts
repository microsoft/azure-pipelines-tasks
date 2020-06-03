export class CommandHelper {

    /**
     * Extracts OS specific environment variables from the command string.
     * @returns {string[]} Array of environment variables
     * @param {string} command Command to be processed
     */
    private static getEnvVariables(command: string): string[] {
        let variables: string[] = [];
        if (process.platform === 'win32') {
            // getting Windows specific variables
            variables = command.match(/\%[^\s]+\%/g);
        } else {
            // getting Linux/macOS specific variables
            variables = command.match(/\$\w+/g);
        }
        return variables;
    }

    /**
     * Extracts name from variable
     * @returns {string} Name extracted from variable
     * @param {string} variable Variable which name should be extracted
     */
    private static getVariableName(variable: string): string {
        return variable.replace(/[$%]/g, '');
    }

    /**
     * Replaces environment variables by their values in command string. Variable won't be changed if no value found.
     * @returns {string} Part of command with environment variables replaced by their values.
     * @param {string} line Part of command where environment variables should be replaced by their values.
     */
    public static replaceEnvVariablesWithValues(line: string): string {
        let resultArgs: string = line;
        const variables = this.getEnvVariables(line);
        for (const variable of variables) {
           const value: string = process.env[this.getVariableName(variable)];
           if (value) {
               resultArgs = resultArgs.replace(new RegExp(variable.replace(/\$/, '\\$'), 'g'), value);
           }
        }
        return resultArgs;
    }
}