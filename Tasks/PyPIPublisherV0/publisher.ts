import * as tl from 'vsts-task-lib/task';
import * as os from 'os';
import * as path from 'path';
import * as util from "util";

const serviceEndpointId = tl.getInput('serviceEndpoint', true);

// Generic service endpoint
const pypiServer = tl.getEndpointUrl(serviceEndpointId, false);
const username = tl.getEndpointAuthorizationParameter(serviceEndpointId, 'username', false);
const password = tl.getEndpointAuthorizationParameter(serviceEndpointId, 'password', false);

// Create .pypirc file
const homedir = os.homedir();
const pypircFilePath = path.join(homedir, ".pypirc");
const text = util.format("[distutils] \nindex-servers =\n    pypi \n[pypi] \nrepository=%s \nusername=%s \npassword=%s", pypiServer, username, password);
tl.writeFile(pypircFilePath, text, 'utf8');

async function run() {
    try {
        await executePythonTool("-m pip install twine --user");
        await executePythonTool("-m twine upload dist/*");
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    } finally {
        // Delete .pypirc file
        tl.rmRF(pypircFilePath);
        tl.setResult(tl.TaskResult.Succeeded, '');
    }
}

async function executePythonTool(commandToExecute: string): Promise<void> {
    const python = tl.tool('python');
    python.line(commandToExecute);

    try {
        await python.exec();
    } catch (err) {
        // vsts-task-lib 2.5.0: `ToolRunner` does not localize its error messages
        throw new Error(tl.loc('UploadFailed', err));
    }
}

run();
