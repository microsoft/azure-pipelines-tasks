import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import * as os from 'os';
import * as fs from 'fs';
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
        const projectName = this.getProjectName(projectPath);
        tl.debug(`Project name: ${projectName}`);

        // Where the .dacpac will land. An explicitly requested output directory is honoured;
        // otherwise the task pins one so the location never has to be predicted.
        const userSpecifiedOutput = this.findUserSpecifiedOutputDirectory(projectPath, buildArguments);
        const outputDir = userSpecifiedOutput ?? this.getTaskOwnedOutputDirectory(projectPath, projectName);
        tl.debug(`Expected output directory: ${outputDir}`);

        // Build the project
        tl.debug(tl.loc('BuildingSqlProject', projectPath));
        await this.executeBuild(projectPath, buildArguments, userSpecifiedOutput ? undefined : outputDir);

        // Locate the built .dacpac — use fs.existsSync (not tl.exist) so mock tests can intercept this check
        const dacpacPath = path.join(outputDir, `${projectName}.dacpac`);
        if (!fs.existsSync(dacpacPath)) {
            throw new Error(tl.loc('DacpacNotFoundAfterBuild', dacpacPath));
        }

        tl.debug(tl.loc('SqlProjectBuiltSuccessfully', dacpacPath));
        return dacpacPath;
    }

    /**
     * The project file name without its extension. The comparison is case-insensitive because
     * Windows accepts MyDb.SQLPROJ, and MSBuild names the output after the project either way.
     */
    public static getProjectName(projectPath: string): string {
        const fileName = path.basename(projectPath);
        return fileName.replace(/\.sqlproj$/i, '');
    }

    /**
     * The output directory the user asked for, if any.
     *
     * dotnet accepts --output/-o as well as the MSBuild property OutputPath, which can be written
     * as -p:, --property: or /p:. All of them are honoured so that an explicit choice is never
     * quietly replaced by the directory this task would otherwise pin.
     */
    public static findUserSpecifiedOutputDirectory(projectPath: string, buildArguments?: string): string | undefined {
        if (!buildArguments) {
            return undefined;
        }

        const outputDir = this.findArgument(buildArguments, '--output', '-o')
            ?? this.findMsBuildProperty(buildArguments, 'OutputPath');

        if (!outputDir) {
            return undefined;
        }

        // Resolve relative paths against the project directory so dacpac lookup works
        // regardless of the task's working directory
        return path.resolve(path.dirname(projectPath), outputDir);
    }

    /**
     * The directory this task pins for build output when the user has not chosen one.
     *
     * Predicting MSBuild's default location cannot be done reliably: it depends on Configuration,
     * which can be set through --configuration, -p:Configuration, --property:Configuration or the
     * project file itself, and on OutputPath, which the project file may also define. Pinning the
     * directory and passing it as the last argument removes every one of those variables.
     */
    public static getTaskOwnedOutputDirectory(projectPath: string, projectName: string): string {
        const root = tl.getVariable('Agent.TempDirectory') || os.tmpdir();
        return path.join(root, 'sqlproj-build-output', projectName);
    }

    /**
     * Finds an MSBuild property value written as -p:Name=Value, --property:Name=Value or
     * /p:Name=Value, with an optionally quoted value.
     */
    private static findMsBuildProperty(args: string, propertyName: string): string | undefined {
        const patterns = [
            new RegExp(`(?:-p|--property|/p):${propertyName}="([^"]+)"`, 'i'),
            new RegExp(`(?:-p|--property|/p):${propertyName}=([^\\s]+)`, 'i')
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
    private static async executeBuild(projectPath: string, buildArguments?: string, forcedOutputDir?: string): Promise<void> {
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

        // Last one wins in MSBuild, so pinning the output directory after the user's arguments keeps
        // it authoritative over a Configuration switch or an OutputPath set inside the project file.
        // A trailing separator is what MSBuild expects for a directory-valued property.
        if (forcedOutputDir) {
            args.push(`-p:OutputPath=${forcedOutputDir}${path.sep}`);
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
                    process.stdout.write(chunk);
                    callback();
                }
            }),
            errStream: new Writable({
                write: (chunk: Buffer, encoding: string, callback: () => void) => {
                    buildError += chunk.toString();
                    process.stderr.write(chunk);
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
