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
     * The two ways of asking resolve differently, and the difference is not cosmetic:
     *   --output / -o        dotnet resolves a relative path against the **current directory**
     *   -p:OutputPath=       MSBuild resolves it against the **project directory**
     * Resolving both the same way makes a nested project build successfully and then be searched
     * for in a directory that does not exist.
     *
     * Detection runs over the same tokens that are passed to dotnet, so a value can never be read
     * differently from the way it is executed.
     */
    public static findUserSpecifiedOutputDirectory(projectPath: string, buildArguments?: string): string | undefined {
        if (!buildArguments) {
            return undefined;
        }

        const tokens = this.parseArguments(buildArguments);

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            if (/^(--output|-o)$/i.test(token)) {
                const value = tokens[i + 1];
                if (value) {
                    return path.resolve(process.cwd(), value);
                }
            }

            const inlineOutput = /^(?:--output|-o)[:=](.+)$/i.exec(token);
            if (inlineOutput) {
                return path.resolve(process.cwd(), inlineOutput[1]);
            }
        }

        for (const token of tokens) {
            const outputPath = /^(?:-p|--property|\/p):OutputPath=(.+)$/i.exec(token);
            if (outputPath) {
                return path.resolve(path.dirname(projectPath), outputPath[1]);
            }
        }

        return undefined;
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
            } else if (char === ' ' && !inQuotes) {
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
