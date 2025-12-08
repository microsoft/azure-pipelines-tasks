import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as path from 'path';
import os = require('os');

let taskPath = path.join(__dirname, '..', 'src', 'index.js');
let tmr = new tmrm.TaskMockRunner(taskPath);

tmr.setAnswers({
    "which": {
        "notation": ""
    },
    "exec": {
        "tar xC . -f notation_1.0.0_linux_amd64.tar.gz": {
            "code": 0,
            "stdout": "extracted"
        }
    }
})

tmr.registerMock('azure-pipelines-tool-lib/tool', {
    downloadTool(url: string, filename: string): Promise<string> {
        return Promise.resolve('notation_1.0.0_linux_amd64.tar.gz');
    },
    extractTar(file: string, destination?: string | undefined): Promise<string> {
        return Promise.resolve('extracted');
    },
    prependPath(toolPath: string) {
        return;
    }
});

tmr.registerMock('./crypto', {
    computeChecksum: (filePath: string) => {
        return Promise.resolve('eceec8cb6d5cbaeb8f6f22399eb89317fe005a85206a5e780fdde1ef5bb64596');
    }
})

os.platform = () => {
    return 'linux' as NodeJS.Platform;
}
os.arch = () => {
    return 'x64';
}
tmr.registerMock('os', os);

process.env['AGENT_TEMPDIRECTORY'] = '.';
tmr.setInput('command', 'install');
tmr.setInput('version', '1.0.0');

tmr.run();
