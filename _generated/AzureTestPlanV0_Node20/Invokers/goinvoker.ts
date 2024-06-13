import tl = require('azure-pipelines-task-lib/task');
import utils = require('../utils');
import constants = require('../constants');
import tr = require("azure-pipelines-task-lib/toolrunner");

//GO command like "gotestsum --junitfile TEST-Go<i>-junit.xml -- <filepath> -v -run ^<TestName>$"
export async function executeGoTests(testsToBeExecuted: string[]): Promise<number> {
    
    let goPath = tl.which("go", true);
    let go: tr.ToolRunner = tl.tool(goPath);
    let argument = constants.INSTALL_GOTESTSUM;
    go.line(argument);
    await go.exec(<tr.IExecOptions>{ cwd: "" });
    tl.debug("Installed Gotestsum");

//testsToBeExecuted: go.mod/01-normal/normal.Test1,go.mod/01-normal/normal.Test11,go.mod/04-testmain.Test1,go.mod/05-parallel.TestSumParalel
    goPath = tl.which("gotestsum", true);
    let i = 0;
    for (let tests of testsToBeExecuted) {
        try {
            const modifiedPath = utils.separatePath(tests);
            const modifiedTest = utils.separateTestName(tests);   
            const argument = `--junitfile TEST-Go${i}-junit.xml -- ${modifiedPath} -v -run ^${modifiedTest}$ `;
            let go: tr.ToolRunner = tl.tool(goPath);
            go.line(argument);
            await go.exec(<tr.IExecOptions>{ cwd: "" });
            tl.debug("Tests Run Sucessfully" );
        } catch (error) {
            console.error(`Error executing test case:`, error);
        }
        i++;
    }
    return 0;
}