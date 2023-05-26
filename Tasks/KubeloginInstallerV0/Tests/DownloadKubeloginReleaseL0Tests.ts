import { getKubeloginRelease, KubeloginRelease, downloadKubeloginRelease} from "../utils";
import { TestString } from "./TestStrings";
import * as taskLib from 'azure-pipelines-task-lib/task';
import path = require('path');
const fs = require('fs')


const tempDir = path.join(__dirname, "temp");
taskLib.setVariable("agent.TempDirectory", tempDir);
taskLib.setVariable("Agent.ToolsDirectory", tempDir);

export class DownloadKubeloginReleaseL0Tests {

    public static async startTests() {
        this.validateDownloadKubelogin();
        if(!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }
    }

    public static async validateDownloadKubelogin() {
        const kubeloginRelease: KubeloginRelease = await getKubeloginRelease('latest');
        const toolPath = await downloadKubeloginRelease(kubeloginRelease);

        const isExists = fs.existsSync(toolPath)
        if(isExists) {
            console.log("kubelogin downloaded successfully")
        }
    }


}

DownloadKubeloginReleaseL0Tests.startTests();