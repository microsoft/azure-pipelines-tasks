import { TestSummary } from "./testresultspublisher";
import * as tl from 'azure-pipelines-task-lib/task';
import { chmodSync, existsSync } from 'fs';
import * as path from "path";
import downloadutility = require("utility-common/downloadutility");

export class TestRunner {
    constructor(testFilePath: string, imageName: string) {
        this.testFilePath = testFilePath;
        this.imageName = imageName;
    }

    public async Run(): Promise<TestSummary> {
        return new Promise<TestSummary>(async (resolve, reject) => {
            try {
                const runnerDownloadUrl = this.getContainerStructureTestRunnerDownloadPath(this.osType);
                if (!runnerDownloadUrl) {
                    throw new Error("Unable to get runner download path");
                }

                const runnerPath = await this.downloadTestRunner(runnerDownloadUrl);
                tl.debug(`Successfully downloaded : ${runnerDownloadUrl}`);

                var start = new Date().getTime();
                const output: string = this.runContainerStructureTest(runnerPath, this.testFilePath, this.imageName);
                var end = new Date().getTime();

                if (!output || output.length <= 0) {
                    throw new Error("No output from runner");
                }
        
                tl.debug(`Successfully finished testing`);
                let resultObj: TestSummary = JSON.parse(output);
                resultObj.Duration = end-start;
                console.log(`Total Tests: ${resultObj.Total}, Pass: ${resultObj.Pass}, Fail: ${resultObj.Fail}`);
                resolve(resultObj);
            } catch (error) {
                reject(error)
            }
        });
    }

    private getContainerStructureTestRunnerDownloadPath(osType: string): string {
        switch (osType) {
            case 'darwin':
                return "https://storage.googleapis.com/container-structure-test/latest/container-structure-test-darwin-amd64";
            case 'linux':
                return "https://storage.googleapis.com/container-structure-test/latest/container-structure-test-linux-amd64";
            default:
                return null;
        }
    }
    
    private async downloadTestRunner(downloadUrl: string): Promise<string> {
        const gcst = path.join(__dirname, "container-structure-test");
        return downloadutility.download(downloadUrl, gcst, false, true).then((res) => {
            chmodSync(gcst, "777");
            if (!existsSync(gcst)) {
                tl.error(tl.loc('FileNotFoundException', path));
                throw new Error(tl.loc('FileNotFoundException', path));
            }
            return gcst;
        }).catch((reason) => {
            tl.error(tl.loc('DownloadException', reason));
            throw new Error(tl.loc('DownloadException', reason));
        })
    }

    private runContainerStructureTest(runnerPath: string, testFilePath: string, image: string): string {
        let command = tl.tool(runnerPath);
        command.arg(["test", "--image", image, "--config", testFilePath, "--json"]);
    
        const output = command.execSync();
        let jsonOutput: string;
    
        if (!output.error) {
            jsonOutput = output.stdout;
        } else {
            tl.error(tl.loc('ErrorInExecutingCommand', output.error));
            throw new Error(tl.loc('ErrorInExecutingCommand', output.error));
        }
    
        tl.debug("Standard Output: " + output.stdout);
        tl.debug("Standard Error: " + output.stderr);
        tl.debug("Error from command executor: " + output.error);
        tl.debug("Return code from command executor: " + output.code);
    
        return jsonOutput;
    }

    private readonly testFilePath: string;
    private readonly imageName: string;
    private readonly osType = tl.osType().toLowerCase();
}