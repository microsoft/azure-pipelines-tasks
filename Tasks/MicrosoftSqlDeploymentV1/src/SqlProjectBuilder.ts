import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import { Writable } from 'stream';

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

        // Get project name without extension
        const projectName = path.basename(projectPath, '.sqlproj');
        tl.debug(`Project name: ${projectName}`);

        // Parse build arguments to determine output directory
        const outputDir = this.getOutputDirectory(projectPath, buildArguments);
        tl.debug(`Expected output directory: ${outputDir}`);

        // Build the project
        tl.debug(tl.loc('BuildingSqlProject', projectPath));
        await this.executeBuild(projectPath, buildArguments);

        // Locate the built .dacpac
        const dacpacPath = path.join(outputDir, `${projectName}.dacpac`);
        if (!tl.exist(dacpacPath)) {
            throw new Error(tl.loc('DacpacNotFoundAfterBuild', dacpacPath));
        }

        tl.debug(tl.loc('SqlProjectBuiltSuccessfully', dacpacPath));
        return dacpacPath;
    }

    /**
     * Determines the output directory for the built .dacpac
     * Parses buildArguments for --output/-o or uses default bin/<configuration>
     */
    private static getOutputDirectory(projectPath: string, buildArguments?: string): string {
        if (!buildArguments) {
            // Default: bin/Debug
            return path.join(path.dirname(projectPath), 'bin', 'Debug');
        }

        // Parse arguments to find --output or -o
        const outputDir = this.findArgument(buildArguments, '--output', '-o');
        if (outputDir) {
            // Resolve relative paths against the project directory so dacpac lookup works
            // regardless of the task's working directory
            return path.resolve(path.dirname(projectPath), outputDir);
        }

        // If no output specified, check for configuration
        const configuration = this.findArgument(buildArguments, '--configuration', '-c') || 'Debug';
        return path.join(path.dirname(projectPath), 'bin', configuration);
    }

    /**
     * Finds an argument value from a command line string
     * Supports both longForm (--output) and shortForm (-o)
     */
    private static findArgument(args: string, longForm: string, shortForm: string): string | undefined {
        // Match patterns like: --output "path" or -o path or --output=path
        const patterns = [
            new RegExp(`${longForm}[\\s=]+"([^"]+)"`, 'i'),  // --output "path"
            new RegExp(`${longForm}[\\s=]+([^\\s]+)`, 'i'),   // --output path or --output=path
            new RegExp(`${shortForm}[\\s]+"([^"]+)"`, 'i'),   // -o "path"
            new RegExp(`${shortForm}[\\s]+([^\\s]+)`, 'i')    // -o path
        ];

        for (const pattern of patterns) {
            const match = args.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        return undefined;
    }

    /**
     * Executes dotnet build command
     */
    private static async executeBuild(projectPath: string, buildArguments?: string): Promise<void> {
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

        tl.debug(`Executing: dotnet ${args.join(' ')}`);

        // Capture stdout and stderr to show actual errors
        let buildOutput = '';
        let buildError = '';

        const result = await tl.exec('dotnet', args, {
            failOnStdErr: false,
            ignoreReturnCode: true,
            outStream: new Writable({
                write: (chunk: Buffer, encoding: string, callback: () => void) => {
                    buildOutput += chunk.toString();
                    callback();
                }
            }),
            errStream: new Writable({
                write: (chunk: Buffer, encoding: string, callback: () => void) => {
                    buildError += chunk.toString();
                    callback();
                }
            })
        });

        if (result !== 0) {
            // Show actual build errors
            const errorMessage = buildError || buildOutput || 'Unknown build error';
            throw new Error(tl.loc('SqlProjectBuildFailed', result, errorMessage));
        }
    }

    /**
     * Parses a command line string into an array of arguments
     * Preserves quoted strings with spaces
     */
    private static parseArguments(args: string): string[] {
        const parsed: string[] = [];
        const regex = /"([^"]+)"|'([^']+)'|(\S+)/g;
        let match;

        while ((match = regex.exec(args)) !== null) {
            // match[1] = double quoted, match[2] = single quoted, match[3] = unquoted
            parsed.push(match[1] || match[2] || match[3]);
        }

        return parsed;
    }
}
