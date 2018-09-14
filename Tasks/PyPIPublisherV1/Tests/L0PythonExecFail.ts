import * as os from 'os';
import * as path from 'path';

import { TaskMockRunner } from 'vsts-task-lib/mock-run';

const homedir = os.homedir();
const pypircFilePath: string = path.join(homedir, ".pypirc");
const publisher = path.join(__dirname, '..', 'publisher.js');
const tmr = new TaskMockRunner(publisher);

tmr.setInput('serviceEndpoint', 'MyTestEndpoint');

// set up endpoint
process.env["ENDPOINT_AUTH_MyTestEndpoint"] = JSON.stringify({
    "parameters": {
        "username": "username",
        "password": "password"
    },
    "scheme": "usernamepassword"
});
process.env["ENDPOINT_URL_MyTestEndpoint"] = "https://example/test";
process.env["ENDPOINT_AUTH_PARAMETER_MyTestEndpoint_USERNAME"] = "username";
process.env["ENDPOINT_AUTH_PARAMETER_MyTestEndpoint_PASSWORD"] = "password";

tmr.setAnswers({
    which: {
        "python": "python"
    },
    checkPath: {
        "python": true
    },
    exec: {
        "python -m pip install twine --user": {
            "code": 1,
            "stdout": "failed to install twine"
        }
    },
    rmRF: {
        [pypircFilePath]: {
            "success": true
        }
    }
});
tmr.run();
