import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import * as fs from 'fs';

export default class SqlProjectBuilder {
    /**
     * Builds a SQL project (.sqlproj) and returns the path to the generated .dacpac
     * @param projectPath Path to the .sqlproj file
     * @param buildArguments Additional arguments to pass to dotnet build
     * @returns Path to the built .dacpac file
     */
    public static async buildProject(projectPath: string, buildArguments?: string): Promise<string> {
        tl.debug(`Building SQL project: ${projectPath}`);

        // Verify dotnet SDK is available
        const dotnetPath = tl.which('dotnet', false);
        if (!dotnetPath) {
            throw new Error(tl.loc('DotnetNotFound'));
        }
        tl.debug(`Found dotnet at: ${dotnetPath}`);

        tl.debug(tl.loc('BuildingSqlProject', projectPath));
        await this.executeBuild(dotnetPath, projectPath, buildArguments);

        // A property query without a target evaluates the project without building again.
        // Keep it separate from the build because -getProperty suppresses normal build logging.
        const output = await this.executeBuild(dotnetPath, projectPath, buildArguments, true);
        let dacpacPath: string;
        try {
            const properties = JSON.parse(output).Properties;
            if (typeof properties.SqlTargetPath !== 'string' || !properties.SqlTargetPath.trim() ||
                typeof properties.MSBuildProjectDirectory !== 'string' || !properties.MSBuildProjectDirectory.trim()) {
                throw new Error('Missing evaluated SQL output path');
            }
            dacpacPath = path.resolve(properties.MSBuildProjectDirectory, properties.SqlTargetPath);
        } catch {
            throw new Error(tl.loc('SqlProjectOutputNotResolved'));
        }

        if (!fs.existsSync(dacpacPath)) {
            throw new Error(tl.loc('DacpacNotFoundAfterBuild', dacpacPath));
        }

        tl.debug(tl.loc('SqlProjectBuiltSuccessfully', dacpacPath));
        return dacpacPath;
    }

    /**
     * Executes dotnet build command
     */
    private static async executeBuild(dotnetPath: string, projectPath: string, buildArguments?: string, queryOutput = false): Promise<string> {
        const args: string[] = [
            'build',
            projectPath,
            '-p:NetCoreBuild=true'
        ];

        // Append user-provided build arguments
        if (buildArguments) {
            // Split arguments preserving quoted strings
            const additionalArgs = this.parseArguments(buildArguments);
            args.push(...additionalArgs);
        }

        if (queryOutput) {
            args.push('-getProperty:SqlTargetPath,MSBuildProjectDirectory');
        }

        tl.debug(`Executing: dotnet ${args.join(' ')}`);

        // Capture stdout and stderr to show actual errors
        let buildOutput = '';
        let buildError = '';

        const tool = tl.tool(dotnetPath).arg(args);
        tool.on('stdout', (chunk: Buffer) => { buildOutput += chunk.toString(); });
        tool.on('stderr', (chunk: Buffer) => { buildError += chunk.toString(); });

        const result = await tool.exec({
            failOnStdErr: false,
            ignoreReturnCode: true,
            silent: queryOutput
        });

        if (result !== 0) {
            // Show actual build errors
            const errorMessage = buildError || buildOutput || 'Unknown build error';
            throw new Error(tl.loc('SqlProjectBuildFailed', result, errorMessage));
        }

        return buildOutput;
    }

    /**
     * Split a command line string into argv elements.
     *
     * A quote is treated as syntax wherever it appears, not only at the start of a token, so
     * `-p:OutputPath="out dir"` stays one argument. Matching on the start alone split it in two and
     * handed MSBuild a truncated path. Quotes are removed once they have done their job of keeping
     * a value together, because argv elements are passed to the tool directly and never through a
     * shell.
     */
    private static parseArguments(args: string): string[] {
        const parsed: string[] = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';
        let hasContent = false;

        const flush = (): void => {
            parsed.push(current);
            current = '';
            hasContent = false;
        };

        for (const char of args) {
            if ((char === '"' || char === "'") && !inQuotes) {
                inQuotes = true;
                quoteChar = char;
                // An empty quoted value is still a value, so remember it was quoted.
                hasContent = true;
            } else if (char === quoteChar && inQuotes) {
                inQuotes = false;
                quoteChar = '';
            } else if (/\s/.test(char) && !inQuotes) {
                if (current.length > 0 || hasContent) {
                    flush();
                }
            } else {
                current += char;
            }
        }

        if (current.length > 0 || hasContent) {
            flush();
        }

        return parsed;
    }
}
