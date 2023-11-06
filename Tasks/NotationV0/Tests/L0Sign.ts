import * as path from 'path';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';

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
        "notation plugin list": {
            "code": 0,
            "stdout": "extracted" 
        },
        "notation sign localhost:5000/e2e@sha256:xxxxxx --plugin azure-kv --id https://xxx.vault.azure.net/keys/self-signed-cert/a12c1ba176df4476a9325ca48ff796ad --signature-format cose --plugin-config=self_signed=true": {
            "code": 0,
            "stdout": "extracted" 
        }
    },
})

tmr.registerMock('azure-pipelines-tool-lib/tool', {
    downloadTool(url: string, filename: string): Promise<string> {
        return Promise.resolve('notation-azure-kv_1.0.0_linux_amd64.tar.gz');
    },
    extractTar(file: string, destination?: string | undefined): Promise<string> {
        return Promise.resolve('extracted');
    },
});

tmr.registerMock('./crypto', {
    computeChecksum: (filePath: string) => {
        return Promise.resolve('f8a75d9234db90069d9eb5660e5374820edf36d710bd063f4ef81e7063d3810b');
    }
})

process.env['AGENT_TEMPDIRECTORY'] = '.';
tmr.setInput('command', 'sign');
tmr.setInput('akvPluginVersion', '1.0.1');
tmr.setInput('artifactRefs', 'localhost:5000/e2e@sha256:xxxxxx');
tmr.setInput('plugin', 'azureKeyVault');
tmr.setInput('azurekvServiceConection', 'akv-service-connection');
tmr.setInput('keyid', 'https://xxx.vault.azure.net/keys/self-signed-cert/a12c1ba176df4476a9325ca48ff796ad')
tmr.setInput('selfSigned', 'true');

tmr.run();
