"use strict";

import tl = require('azure-pipelines-task-lib/task');
import secureFilesCommon = require('securefiles-common/securefiles-common');
import path = require('path');

tl.setResourcePath(path.join(__dirname, '..' , 'task.json'));

async function run() {
    var enableTls = tl.getBoolInput('enableTls', false);

    if(!enableTls) {
        tl.debug(tl.loc("SkipDownloadSecureFiles"));
        return;
    }

    var caCert = tl.getInput('caCert', true);
    var cert = tl.getInput('certificate', true);
    var key = tl.getInput('privatekey', true);

    try {
        var secureFileHelpers = new secureFilesCommon.SecureFileHelpers();
        var caCertFilePath: string = await secureFileHelpers.downloadSecureFile(caCert);
        tl.setTaskVariable('CACERT_FILE_PATH', caCertFilePath);
        var certFilePath: string = await secureFileHelpers.downloadSecureFile(cert);
        tl.setTaskVariable('CERT_FILE_PATH', certFilePath);
        var keyFilePath: string = await secureFileHelpers.downloadSecureFile(key);
        tl.setTaskVariable('KEY_FILE_PATH', keyFilePath);
    } catch(err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

run().then(()=>{
    // do nothing
}, (reason)=> {
        tl.setResult(tl.TaskResult.Failed, reason);
});