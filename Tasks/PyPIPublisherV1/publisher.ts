import * as tl from 'vsts-task-lib/task';
import * as os from 'os';
import * as path from 'path';

interface Credentials {
    username: string,
    password: string
}

/** Retrieve the username and password from a generic service endpoint. */
function getCredentials(serviceEndpointId: string): Credentials {
    return {
        username: tl.getEndpointAuthorizationParameter(serviceEndpointId, 'username', false),
        password: tl.getEndpointAuthorizationParameter(serviceEndpointId, 'password', false)
    };
}

function writePypirc(filepath: string, pypiServer: string, credentials: Credentials): void {
    const text =
    `[distutils]
    index-servers =
        pypi
    [pypi]
    repository=${pypiServer}
    username=${credentials.username}
    password=${credentials.password}`;

    tl.writeFile(filepath, text, 'utf8');
}

async function executePythonTool(commandToExecute: string): Promise<void> {
    const python = tl.tool('python');
    python.line(commandToExecute);

    try {
        await python.exec();
    } catch (err) {
        // vsts-task-lib 2.1.0: `ToolRunner` does not localize its error messages
        throw new Error(tl.loc('UploadFailed', err));
    }
}

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        const pypircFilePath = path.join(os.homedir(), ".pypirc");
        const serviceEndpointId = tl.getInput('serviceEndpoint', true);
        const pypiServer = tl.getEndpointUrl(serviceEndpointId, false);
        writePypirc(pypircFilePath, pypiServer, getCredentials(serviceEndpointId));

        try {
            await executePythonTool("-m pip install twine --user");
            await executePythonTool("-m twine upload dist/*");
        } finally {
            // Delete .pypirc file
            tl.rmRF(pypircFilePath);
        }

        tl.setResult(tl.TaskResult.Succeeded, '');
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

run();
