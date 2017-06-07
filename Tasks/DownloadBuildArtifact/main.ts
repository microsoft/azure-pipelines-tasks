import {BuildArtifact, ArtifactResource} from 'vso-node-api/interfaces/BuildInterfaces';
import {WebApi, getHandlerFromToken} from 'vso-node-api/WebApi';
import * as tl from 'vsts-task-lib/task';

import {ArtifactProvider} from './ArtifactProvider';
import {FileContainerProvider} from './FileContainer';

async function main(): Promise<void> {
	try {
		let projectId = tl.getVariable('System.TeamProjectId');
		let artifactName = tl.getInput("artifactName");
		let downloadPath = tl.getPathInput("downloadPath");
		let buildId = parseInt(tl.getInput("buildId"));

		if (isNaN(buildId)) {
			throw new Error(tl.loc("InvalidBuildId", tl.getInput("buildId")));
		}

		let accessToken = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'AccessToken', false);
		let credentialHandler = getHandlerFromToken(accessToken);
		let collectionUrl = tl.getEndpointUrl('SYSTEMVSSCONNECTION', false);
		let vssConnection = new WebApi(collectionUrl, credentialHandler);

		// get the artifact metadata
		let buildApi = vssConnection.getBuildApi();
		let artifact = await buildApi.getArtifact(buildId, artifactName, projectId);

		let providers: ArtifactProvider[] = [
			new FileContainerProvider()
		];

		let provider = providers.filter((provider) => provider.supportsArtifactType(artifact.resource.type))[0];
		if (provider) {
			await provider.downloadArtifact(artifact, downloadPath);
		}
		else {
			throw new Error(tl.loc("ArtifactProviderNotFound", artifact.resource.type));
		}

		tl.setResult(tl.TaskResult.Succeeded, "");
	}
	catch (err) {
		tl.setResult(tl.TaskResult.Failed, err);
	}
}

main();