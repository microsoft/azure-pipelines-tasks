'use strict';
import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import * as utils from './utils/utilities';

import { bake } from './actions/bake';
import { createSecret } from './actions/createSecret';
import { deleteResources } from './actions/delete';
import { deploy } from './actions/deploy';
import { patch } from './actions/patch';
import { promote } from './actions/promote';
import { reject } from './actions/reject';
import { scale } from './actions/scale';

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

async function run(): Promise<void> {
    const action = tl.getInput('action');
    if (action === 'bake') {
        return bake();
    }
    const connection = utils.getConnection();
    let action_func = null;
    switch (action) {
        case 'deploy':
            action_func = deploy;
            break;
        case 'scale':
            action_func = scale;
            break;
        case 'patch':
            action_func = patch;
            break;
        case 'delete':
            action_func = deleteResources;
            break;
        case 'promote':
            action_func = promote;
            break;
        case 'reject':
            action_func = reject;
            break;
        case 'createSecret':
            action_func = createSecret;
            break;
        default:
            tl.setResult(tl.TaskResult.Failed, 'Not a supported action, choose from "bake", "deploy", "patch", "scale", "delete", "promote", "reject"');
            process.exit(1);
    }
    await connection.open();
    return action_func(connection.ignoreSSLErrors)
        .then(() => connection.close())
        .catch((error) => {
            connection.close();
            throw error;
        });
}

run()
    .catch((error) => tl.setResult(tl.TaskResult.Failed, !!error.message ? error.message : error));