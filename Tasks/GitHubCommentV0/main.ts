import * as tl from 'azure-pipelines-task-lib/task';
import { sendRequest, WebRequest, WebResponse } from './httpclient';
import * as path from 'path';

tl.setResourcePath(path.join(__dirname, 'task.json'));

function getGithubEndPointToken(githubEndpoint: string): string {
    const githubEndpointObject = tl.getEndpointAuthorization(githubEndpoint, false);
    let githubEndpointToken: string = null;

    if (!!githubEndpointObject) {
        tl.debug('Endpoint scheme: ' + githubEndpointObject.scheme);

        if (githubEndpointObject.scheme === 'PersonalAccessToken') {
            githubEndpointToken = githubEndpointObject.parameters.accessToken;
        } else if (githubEndpointObject.scheme === 'OAuth') {
            githubEndpointToken = githubEndpointObject.parameters.AccessToken;
        } else if (githubEndpointObject.scheme === 'Token') {
            githubEndpointToken = githubEndpointObject.parameters.AccessToken;
        } else if (githubEndpointObject.scheme) {
            throw new Error(tl.loc('InvalidEndpointAuthScheme', githubEndpointObject.scheme));
        }
    }

    if (!githubEndpointToken) {
        throw new Error(tl.loc('InvalidGitHubEndpoint', githubEndpoint));
    }

    return githubEndpointToken;
}

function writeComment(repositoryName: string, id: string, comment: string, token: string) {
    const url = `https://api.github.com/repos/${repositoryName}/issues/${id}/comments`;
    const body = {
        'body': comment
    };
    const headers = {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json'
    };

    const request = new WebRequest();
    request.uri = url;
    request.body = JSON.stringify(body);
    request.headers = headers;
    request.method = 'POST';

    return sendRequest(request).then((response: WebResponse) => {
        if (response.statusCode !== 201) {
            tl.debug(JSON.stringify(response));
            throw new Error(tl.loc('WriteFailed'));
        } else {
            console.log(tl.loc('WriteSucceeded'));
        }
    });
}

function run(): Promise<void> {
    const endpointId = tl.getInput('gitHubConnection', true);
    const token = getGithubEndPointToken(endpointId);
    const repositoryName = tl.getInput('repositoryName', true);
    let id = tl.getInput('id');
    if (!id && tl.getVariable('Build.SourceBranch') && tl.getVariable('Build.SourceBranch').startsWith('refs/pull/')) {
        id = tl.getVariable('Build.SourceBranch').split('/')[2];
    }

    let comment = tl.getInput('comment');
    if (!comment) {
        comment = tl.getVariable('GITHUB_COMMENT');
    }

    if (!comment || !id) {
        console.log(tl.loc('NoOp'));
        return Promise.resolve();
    }
    return writeComment(repositoryName, id, comment, token);
}

run()
    .then(() => tl.setResult(tl.TaskResult.Succeeded, ''))
    .catch((error: Error) => tl.setResult(tl.TaskResult.Failed, error.message));