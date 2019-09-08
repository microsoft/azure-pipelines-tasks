import * as tl from 'azure-pipelines-task-lib/task';
import { chmodSync, mkdirSync } from 'fs';

async function run() {
    try {
        const osType = tl.osType().toLowerCase();
        tl.debug('OS type: ' + osType);
        tl.debug('Starting execution');
        // if (osType == "Linux") {
            chmodSync("./container-structure-test-linux-amd64", 777);
            tl.debug('Done with chmod');
            mkdirSync("$HOME/bin", "-p");
            tl.debug('done with mkdir');
            tl.mv("./container-structure-test-linux-amd64","$HOME/bin/container-structure-test");
            tl.debug('done with mv');
            // export("PATH=$PATH:$HOME/bin");
            const output = tl.execSync("container-structure-test", "test --image trydockerpy --config ./fileexistteset2.yaml --json");
            tl.debug('done with execution')
            tl.debug('test output:' + output.stdout);
            tl.debug('test error:' + output.error);
            tl.debug('test stderr:' + output.stderr);
            tl.debug('test code:' + output.code);
        // } else {
            // tl.debug('unsupported OS');
        // }
    } catch (err) {
        tl.debug("Error occured: " + err);
    } finally {
        tl.debug("Stopping execution");
    }
}

run();