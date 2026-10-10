import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import { BuildArtifact } from '../build/buildClient';
import { IntegrityError } from '../errors';
import { forEachLimit } from '../util/concurrency';
import { DEFAULT_MATCH_OPTIONS, matchPaths } from '../util/patterns';
import { ArtifactDownloadParameters, ArtifactProvider, ProviderContext } from './types';

const DEFAULT_STREAM_BUFFER_SIZE = 8192;

function trimTrailingSeparators(value: string): string {
    return value.replace(/[\\/]+$/, '');
}

function format(message: string, ...args: unknown[]): string {
    return util.format(message.replace(/%s/g, '%s'), ...args);
}

interface PlannedFile {
    source: string;
    relative: string;
    matchPath: string;
}

export class FileShareProvider implements ArtifactProvider {
    constructor(protected readonly context: ProviderContext) { }

    async downloadSingleArtifact(params: ArtifactDownloadParameters, artifact: BuildArtifact): Promise<void> {
        await this.downloadMultipleArtifacts(params, [artifact]);
    }

    async downloadMultipleArtifacts(params: ArtifactDownloadParameters, artifacts: BuildArtifact[]): Promise<void> {
        this.context.logger.warning(this.loc('DownloadArtifactWarning', 'Please use Download Build Artifact task for downloading %s type artifact. https://docs.microsoft.com/en-us/azure/devops/pipelines/tasks/utility/download-build-artifacts?view=azure-devops', 'UNC'));

        for (const artifact of artifacts) {
            const sourceRoot = path.join(trimTrailingSeparators(artifact.resource.data), artifact.name);
            const destinationRoot = path.join(params.targetDirectory, artifact.name);
            const selected = await this.planFiles(sourceRoot, artifact.name, params);
            await forEachLimit(selected, 1, file => this.copyFile(file.source, path.join(destinationRoot, file.relative)), this.context.signal);
        }
    }

    private loc(key: string, fallback: string, ...args: unknown[]): string {
        if (this.context.loc) {
            return this.context.loc(key, ...args);
        }
        return format(fallback, ...args);
    }

    private async planFiles(sourceRoot: string, artifactName: string, params: ArtifactDownloadParameters): Promise<PlannedFile[]> {
        const files = await this.enumerateFiles(sourceRoot);
        const paths = files.map(file => path.join(artifactName, file.relative).replace(/\\/g, '/'));
        const matched = new Set(matchPaths(paths, params.minimatchFilters, params.customMinimatchOptions ?? DEFAULT_MATCH_OPTIONS, this.context.logger));
        const selected = files.filter(file => matched.has(path.join(artifactName, file.relative).replace(/\\/g, '/')));

        this.context.logger.debug(`${selected.length} final results`);
        for (const file of files) {
            const matchPath = path.join(artifactName, file.relative).replace(/\\/g, '/');
            if (!matched.has(matchPath)) {
                this.context.logger.debug(`File excluded: ${file.source}`);
            }
        }
        return selected.map(file => ({ ...file, matchPath: path.join(artifactName, file.relative).replace(/\\/g, '/') }));
    }

    private async enumerateFiles(sourceRoot: string): Promise<Array<{ source: string; relative: string }>> {
        const root = trimTrailingSeparators(path.resolve(sourceRoot));
        const result: Array<{ source: string; relative: string }> = [];
        const stack = [root];
        while (stack.length > 0) {
            const current = stack.pop()!;
            for (const entry of await fs.promises.readdir(current, { withFileTypes: true })) {
                const absolute = path.join(current, entry.name);
                if (entry.isDirectory()) {
                    stack.push(absolute);
                } else if (entry.isFile()) {
                    result.push({ source: absolute, relative: path.relative(root, absolute) });
                }
            }
        }
        return result;
    }

    private async copyFile(source: string, destination: string): Promise<void> {
        this.context.logger.info(this.loc('CopyFileToDestination', "Copy file '%s' to '%s'", source, destination));
        await fs.promises.mkdir(path.dirname(destination), { recursive: true });
        const sourceStream = fs.createReadStream(source, { highWaterMark: DEFAULT_STREAM_BUFFER_SIZE });
        const targetStream = fs.createWriteStream(destination, { highWaterMark: DEFAULT_STREAM_BUFFER_SIZE });
        await new Promise<void>((resolve, reject) => {
            sourceStream.once('error', reject);
            targetStream.once('error', reject);
            targetStream.once('finish', resolve);
            sourceStream.pipe(targetStream);
        });
        const [sourceStat, targetStat] = await Promise.all([fs.promises.stat(source), fs.promises.stat(destination)]);
        if (sourceStat.size !== targetStat.size) {
            throw new IntegrityError(this.loc('IntegrityCheckNotPassed', 'Artifact items integrity check failed'));
        }
    }
}
