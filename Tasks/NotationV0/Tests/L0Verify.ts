import * as path from 'path';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import os = require('os');

let taskPath = path.join(__dirname, '..', 'src', 'index.js');
let tmr = new tmrm.TaskMockRunner(taskPath);

tmr.setAnswers({
    "which": {
        "notation": "notation"
    },
    "checkPath": {
        "notation": true
    },
    "exec": {
        "notation policy show": {
            "code": 0,
            "stdout": "extracted" 
        },
        "notation policy import --force ./policy.json": {
            "code": 0,
            "stdout": "extracted" 
        },
        "notation cert list": {
            "code": 0,
            "stdout": "extracted" 
        },
        "notation verify localhost:5000/e2e@sha256:xxxxxx --verbose": {
            "code": 0,
            "stdout": "extracted" 
        },
    },
    "exist": {
        "truststore/x509": true,
        "truststore\\x509": true
    },
    "rmRF": {
        "/user/config/notation/truststore": {
            "success": true
        },
        "\\user\\config\\notation\\truststore": {
            "success": true
        }
    },
})

process.env['AGENT_TEMPDIRECTORY'] = '.';
process.env['XDG_CONFIG_HOME'] = '/user/config';
tmr.setInput('command', 'verify');
tmr.setInput('artifactRefs', 'localhost:5000/e2e@sha256:xxxxxx');
tmr.setInput('trustpolicy', './policy.json')
tmr.setInput('truststore', './truststore')

os.platform = () => {
    return 'linux' as NodeJS.Platform;
}
os.arch = () => {
    return 'x64';
}
tmr.registerMock('os', os);

tmr.run();
