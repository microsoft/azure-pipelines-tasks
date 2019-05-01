"use strict";

import fs = require('fs');
import tl = require('vsts-task-lib/task');
import path = require('path');

tl.setResourcePath(path.join(__dirname, '..' , 'task.json'));

async function run() {
    var enableTls = tl.getBoolInput('enableTls', false);

    if(!enableTls) {
        tl.debug(tl.loc("SkipDeleteSecureFiles"));
    }

    try {
        var caCertFilePath = tl.getTaskVariable('CACERT_FILE_PATH');
        if (caCertFilePath && tl.exist(caCertFilePath)) {
            fs.unlinkSync(caCertFilePath);
        }

        var certFilePath = tl.getTaskVariable('CERT_FILE_PATH');
        if (certFilePath && tl.exist(certFilePath)) {
            fs.unlinkSync(certFilePath);
        }

        var keyFilePath = tl.getTaskVariable('KEY_FILE_PATH');
        if (keyFilePath && tl.exist(keyFilePath)) {
            fs.unlinkSync(keyFilePath);
        }
    } catch(err) {
        tl.warning(err);
    }
}

run();