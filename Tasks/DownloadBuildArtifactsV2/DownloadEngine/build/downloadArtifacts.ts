import { BuildClient } from './buildClient';
import { ArtifactError } from '../errors';
import { getProvider, ArtifactProviders } from '../providers/pipelineArtifactProvider';
import { ArtifactDownloadParameters, ArtifactProvider, ArtifactResourceTypes } from '../providers/types';
import { invalidArtifactNameMessage, isValidArtifactName } from '../util/artifactNames';

export interface DownloadArtifactsOptions {
    buildClient: BuildClient;
    params: ArtifactDownloadParameters;
    providers: ArtifactProviders;
    /** Overrides the default of downloading all artifacts when the artifact name is empty. */
    downloadAll?: boolean;
    /**
     * Called for every artifact of the build whose name is not valid when all artifacts are downloaded. Such an artifact is skipped and
     * the others are downloaded. Without it, an invalid name stops the download before anything is written.
     */
    onInvalidArtifactName?: (name: string | undefined) => void;
    setVariable?: (name: string, value: string) => void;
    signal?: AbortSignal;
}

function requiredProvider(provider: ArtifactProvider | undefined, type: string): ArtifactProvider {
    if (provider) {
        return provider;
    }
    throw new Error(`The artifact provider for resource type '${type}' is not configured.`);
}

function isMultiDownload(artifactName: string | undefined): boolean {
    return artifactName === undefined || artifactName === null || artifactName === '';
}

export async function downloadArtifactsFromBuild(options: DownloadArtifactsOptions): Promise<string[]> {
    const resourceTypes: string[] = [];
    const { buildClient, params, providers, signal } = options;

    if (options.downloadAll ?? isMultiDownload(params.artifactName)) {
        const listed = await buildClient.getArtifacts(params.project, params.pipelineId, signal);
        // The names of the artifacts are those of the build, not of the user, and become folder names: an invalid one is never downloaded.
        const artifacts = listed.filter(artifact => {
            if (isValidArtifactName(artifact.name)) {
                return true;
            }
            if (!options.onInvalidArtifactName) {
                throw new ArtifactError(invalidArtifactNameMessage(artifact.name));
            }
            options.onInvalidArtifactName(artifact.name);
            return false;
        });
        const buildArtifacts = artifacts.filter(artifact => artifact.resource.type?.toLowerCase() === ArtifactResourceTypes.Container.toLowerCase());
        const pipelineArtifacts = artifacts.filter(artifact => artifact.resource.type?.toLowerCase() === ArtifactResourceTypes.PipelineArtifact.toLowerCase());
        const fileShareArtifacts = artifacts.filter(artifact => artifact.resource.type?.toLowerCase() === ArtifactResourceTypes.FileShareArtifact.toLowerCase());

        if (buildArtifacts.length > 0) {
            resourceTypes.push(ArtifactResourceTypes.Container);
            await requiredProvider(providers.container, ArtifactResourceTypes.Container).downloadMultipleArtifacts(params, buildArtifacts);
        }

        if (pipelineArtifacts.length > 0) {
            resourceTypes.push(ArtifactResourceTypes.PipelineArtifact);
            await providers.pipelineArtifact.downloadMultipleArtifacts(params, pipelineArtifacts);
        }

        if (fileShareArtifacts.length > 0) {
            resourceTypes.push(ArtifactResourceTypes.FileShareArtifact);
            await requiredProvider(providers.fileShare, ArtifactResourceTypes.FileShareArtifact).downloadMultipleArtifacts(params, fileShareArtifacts);
        }
    } else {
        if (!isValidArtifactName(params.artifactName)) {
            throw new ArtifactError(invalidArtifactNameMessage(params.artifactName));
        }
        const artifact = await buildClient.getArtifact(params.project, params.pipelineId, params.artifactName!, signal);
        // The name in the answer of the service becomes a folder name just like the one that was asked for.
        if (!isValidArtifactName(artifact.name)) {
            throw new ArtifactError(invalidArtifactNameMessage(artifact.name));
        }
        const provider = getProvider(providers, artifact);
        resourceTypes.push(artifact.resource.type);
        await provider.downloadSingleArtifact(params, artifact);
    }

    // The output variable that earlier versions of the task set, for steps that read it.
    options.setVariable?.('DownloadPipelineArtifactResourceTypes', resourceTypes.join(','));
    return resourceTypes;
}
