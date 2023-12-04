import tmrm = require('azure-pipelines-task-lib/mock-run');
import { setAgentsData, setEndpointData, mockTaskArgument } from './utils';

import path = require('path');
import * as JSZip from "jszip"
import * as uuid from 'uuid';
import * as fs from 'fs';

const tempDir = path.join(__dirname, 'temp');

setEndpointData();

export class TaskParametersTests {
    public static async ValidateLinuxAppTaskParameters() {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        let tp = path.join(__dirname, 'TaskParametersLinuxAppL0Tests.js');
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);
        const zipFilePath = await TaskParametersTests.createSampleZipFile(tempDir);

        tr.setInput("ConnectionType", "AzureRM");
        tr.setInput('ConnectedServiceName', 'AzureRMSpn');
        tr.setInput('WebAppName', 'mytestapp');
        tr.setInput('Package', zipFilePath);
        tr.setInput('UseWebDeploy', 'false');
        tr.setInput('ImageSource', "Builtin Image");
        tr.setInput('WebAppKind', "webAppLinux");
        tr.setInput('RuntimeStack', "dummy|version");
        tr.setInput('BuiltinLinuxPackage', zipFilePath);
        tr.setInput('ScriptType', 'Inline Script');
        tr.setInput('InlineScript','npm install --production');
        setAgentsData()

        const answers = mockTaskArgument();
        answers.exist[zipFilePath] = true;
        answers.stats[zipFilePath] = { "isFile": true };
        answers.checkPath[zipFilePath] = true;
        
        tr.setAnswers(answers);
        tr.run();

        TaskParametersTests.removeDirRecursive(tempDir);
    }

    public static removeDirRecursive(dirPath: string) {
        if (fs.existsSync(dirPath)) {
            fs.readdirSync(dirPath).forEach((entry) => {
                const entryPath = path.join(dirPath, entry);
                if (fs.lstatSync(entryPath).isDirectory()) {
                    TaskParametersTests.removeDirRecursive(entryPath);
                } else {
                    fs.unlinkSync(entryPath);
                }
            });
            fs.rmdirSync(dirPath);
        }
    }

    public static async createSampleZipFile(tempDir: string): Promise<string> {
        const zip = new JSZip();
        zip.file("index.html", "index");
        zip.file("parameters.xml", "parameters");
        zip.file("systemInfo.xml", "systemInfo");
        zip.file("file:../s.txt", `1\n`);

        const content = await zip.generateAsync({ type: "nodebuffer" });
        const outZipPath = path.join(tempDir, `${uuid.v1()}.zip`);
        fs.writeFileSync(outZipPath, content);
        return outZipPath;
    }
}

TaskParametersTests.ValidateLinuxAppTaskParameters();