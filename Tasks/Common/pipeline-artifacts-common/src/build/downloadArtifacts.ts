import { BuildClient } from './buildClient';
import { getProvider, ArtifactProviders } from '../providers/pipelineArtifactProvider';
import { ArtifactDownloadParameters, ArtifactProvider, ArtifactResourceTypes } from '../providers/types';

export interface DownloadArtifactsOptions {
    buildClient: BuildClient;
    params: ArtifactDownloadParameters;
    providers: ArtifactProviders;
    /** Overrides the default of downloading all artifacts when the artifact name is empty. */
    downloadAll?: boolean;
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
        const artifacts = await buildClient.getArtifacts(params.project, params.pipelineId, signal);
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
        const artifact = await buildClient.getArtifact(params.project, params.pipelineId, params.artifactName!, signal);
        const provider = getProvider(providers, artifact);
        resourceTypes.push(artifact.resource.type);
        await provider.downloadSingleArtifact(params, artifact);
    }

    options.setVariable?.('DownloadPipelineArtifactResourceTypes', resourceTypes.join(','));
    return resourceTypes;
}
