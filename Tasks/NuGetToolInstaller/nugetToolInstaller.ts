import * as toolLib from 'vsts-task-tool-lib/tool';
import * as taskLib from 'vsts-task-lib/task';
import * as restm from 'typed-rest-client/RestClient';

import nuGetGetter = require("nuget-task-common/NuGetToolGetter");

async function run() {
    try {
        let versionSpec = taskLib.getInput('versionSpec', true);
        await nuGetGetter.getNuGet(versionSpec);
    }
    catch (error) {
        console.error('ERR:' + error.message);
    }
}

run();