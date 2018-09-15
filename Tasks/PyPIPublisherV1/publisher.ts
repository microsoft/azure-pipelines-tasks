import * as tl from 'vsts-task-lib/task';
import * as os from 'os';
import * as path from 'path';

tl.setResourcePath(path.join(__dirname, 'task.json'));

const serviceEndpointId = tl.getInput('serviceEndpoint', true);

// Generic service endpoint
const pypiServer = tl.getEndpointUrl(serviceEndpointId, false);
const username = tl.getEndpointAuthorizationParameter(serviceEndpointId, 'username', false);
const password = tl.getEndpointAuthorizationParameter(serviceEndpointId, 'password', false);

// Create .pypirc file
const homedir = os.homedir();
const pypircFilePath = path.join(homedir, ".pypirc");
const text =
`[distutils]
index-servers =
    pypi
[pypi]
repository=${pypiServer}
username=${username}
password=${password}`;

tl.writeFile(pypircFilePath, text, 'utf8');

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
        await executePythonTool("-m pip install twine --user");
        await executePythonTool("-m twine upload dist/*");
        tl.setResult(tl.TaskResult.Succeeded, '');
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    } finally {
        // Delete .pypirc file
        tl.rmRF(pypircFilePath);
    }
}

run();
