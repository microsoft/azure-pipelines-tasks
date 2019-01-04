import fs = require('fs');
import path = require('path');
import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, "task.json"));

        //Process working directory
        var cwd = tl.getInput('cwd') || tl.getVariable('System.DefaultWorkingDirectory');
        tl.cd(cwd);

        var openssl: trm.ToolRunner = tl.tool(tl.which('openssl', true));
        openssl.arg(tl.getInput('cipher', true));

        var inFile = tl.getInput('inFile', true);
        openssl.arg(['-d', '-in', inFile]);
        openssl.arg('-out');

        var outFile = tl.getPathInput('outFile', false);
        if(fs.existsSync(outFile) && fs.lstatSync(outFile).isDirectory()) {
            openssl.arg(inFile + '.out');
        } else {
            openssl.arg(outFile);   
        }

        openssl.arg(['-pass','pass:' + tl.getInput('passphrase')]);

        var code: number = await openssl.exec();
        tl.setResult(tl.TaskResult.Succeeded, tl.loc('OpenSSLReturnCode', code));
    }
    catch(err) {
        tl.error(err.message);
        tl.setResult(tl.TaskResult.Failed, tl.loc('OpenSSLFailed', err.message));
    }
}

run();
