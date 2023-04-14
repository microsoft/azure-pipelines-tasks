import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import * as constants from './constants';
import * as util from 'azure-pipelines-tasks-packaging-common/util';
import * as pkgLocationUtils from 'azure-pipelines-tasks-packaging-common/locationUtilities';
import * as url from 'url';
import * as jsyaml from 'js-yaml';

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, 'task.json'));

    try {
        let configCondarc = tl.getInput(constants.CondaAuthenticateTaskInput.ConfigFile);
        if (!configCondarc) {
            throw new Error(tl.loc('ConfigCondarcDoesNotExist', configCondarc));
        } else if (!configCondarc.endsWith('.condarc')) {
            throw new Error(tl.loc('CondarcNotCondarc', configCondarc));
        } else {
            console.log(tl.loc("AuthenticatingThisConfigCondarc", configCondarc));
        }

        const condarcFile = fs.readFileSync(configCondarc, 'utf8');
        const condarcContents = jsyaml.load(condarcFile);
        const condarcLowercaseContents = {};
        Object.keys(condarcContents).forEach(key => {
            condarcLowercaseContents[key.toLowerCase()] = condarcContents[key];
        });
        const channelsAlias = condarcLowercaseContents['channel_alias']; 
        if (!channelsAlias) {
            throw new Error(tl.loc('CondarcMissingChannels'));
        }
        const tokenName = checkTokenName(channelsAlias);
        const localAccesstoken = tl.getVariable('System.AccessToken');
        console.log(tl.loc('AddingAuthChannel', tokenName, channelsAlias));
        tl.setVariable('ARTIFACTS_CONDA_TOKEN', localAccesstoken);
    }
    catch (error) {
        tl.error(error);
        tl.setResult(tl.TaskResult.Failed, tl.loc("FailedToAddAuthentication"));
        return;
    }
}
main();

function checkTokenName(channelsAlias: string): string { //Returns the token's name
    const alias_pieces = channelsAlias.split('@');
    if (alias_pieces.length !== 2) {
        throw new Error(tl.loc('AliasMissingInfo'));
    }
    const user_pieces = alias_pieces[0].split(':');
    if (user_pieces.length !== 3) {
        throw new Error(tl.loc('AliasMissingInfo'));
    }
    if (user_pieces[2][0] !== '$') {
        //Throw error that channels_alias is not in the accepted format
        throw new Error(tl.loc('InvalidTokenFormat'));
    }
    let token_env_var = user_pieces[2].substring(1);
    if (token_env_var.length > 2 && token_env_var[0] === '{' && token_env_var[token_env_var.length - 1] === '}') {
        token_env_var = token_env_var.substring(1, token_env_var.length - 1);
    }
    if (token_env_var !== 'ARTIFACTS_CONDA_TOKEN') {
        // Throw error for not using the designated name
        throw new Error(tl.loc('InvalidTokenName'));
    }
    return token_env_var;
}