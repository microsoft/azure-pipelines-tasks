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
        const channelsAlias = condarcContents['channel_alias'] ? condarcContents['channel_alias'] : '';
        const channelsList = condarcContents['channels'] ? condarcContents['channels']: condarcContents['default_channels']; //A list of strings
        const defaultChannels = condarcContents['channels'] ? condarcContents['default_channels'] : condarcContents['channels']; //A list of strings
        const defaultsCalled = (!condarcContents['channels'] && condarcContents['default_channels']);
        const customChannels = condarcContents['custom_channels']; //An object with key-value pairs
        const customMultiChannels = condarcContents['custom_multichannels'];  //An object with string-list pairs
        const restoreFreeChannel = condarcContents['restore_free_channe'] ? condarcContents['restore_free_channel'] : false;

        if (!channelsList && !defaultChannels) {
            // Throws error for having no channels
            throw new Error(tl.loc('CondarcMissingChannels'));
        }

        const usedMultichannels = new Set<string>();
        const channelPieces = {};  //Entries:  <full channel str as listed> : [<half after '@' symbol>, <TOKEN_ENV_VAR>]

        iterateThroughChannels(channelsList, channelsAlias, channelPieces, usedMultichannels, defaultsCalled, defaultChannels, 
            restoreFreeChannel, customChannels, customMultiChannels);

        if (Object.keys(channelPieces).length === 0) {
            // Throw error for having no channels
            throw new Error(tl.loc('CondarcMissingChannels'));
        }

        let packagingLocation;
        try {
            packagingLocation = await pkgLocationUtils.getPackagingUris(pkgLocationUtils.ProtocolType.Npm);
        } catch (error) {
            tl.debug('Unable to get packaging URIs');
            util.logError(error);
            throw error;
        }
    
        const collectionHosts = packagingLocation.PackagingUris.map((pkgUrl) => {
        const parsedUrl = url.parse(pkgUrl);
            if (parsedUrl && parsedUrl.host) {
                return parsedUrl.host.toLowerCase();
            }
            return undefined;
        });

        let allChannels = '';
            
        Object.entries(channelPieces).forEach(
            ([key, value]) => {
                //Entries:  <full channel str as listed> : [<half after '@' symbol>, <TOKEN_ENV_VAR>]
                const channelUrl = url.parse(value[0]);
                if (channelUrl && channelUrl.host && collectionHosts.indexOf(channelUrl.host.toLowerCase()) >= 0) {
                    if (allChannels !== '') {
                        allChannels += ', ';
                    }
                    allChannels += key;
                }
            }
        )

        tl.setVariable('CONDA_CHANNELS', allChannels);
    }
    catch (error) {
        tl.error(error);
        tl.setResult(tl.TaskResult.Failed, tl.loc("FailedToAddAuthentication"));
        return;
    }
}
main();

function getAliasPieces(fullAlias: string, channelPieces?: {}) {  //returns void
    const condaSplitUrl = fullAlias.split('@');
    if (condaSplitUrl.length > 2) {
        // Throw error for invalid format
       throw new Error(tl.loc('InvalidCondarcFormat', 'a channels'));
    }
    const condaChannelPieces = condaSplitUrl[0].split(':');
    if (condaChannelPieces.length !== 3) {
        //Throw error for having the wrong number of pieces
        //  Pieces should be: ['https', '//<username>', '<PAT>']
        throw new Error(tl.loc('InvalidCondarcFormat', 'a channels'));
    }
    let tokenEnvVar = condaChannelPieces[2];  //The 3rd piece
    if (tokenEnvVar[0] === '$') {
        fullAlias = fullAlias.replace(condaChannelPieces[2], tl.getVariable('System.AccessToken'));
        let start = 1;
        let end = tokenEnvVar.length;
        if ((tokenEnvVar.length > 3) && (tokenEnvVar[1] === '{') && (tokenEnvVar[tokenEnvVar.length - 1] === '}')) {
            start++;
            end--;
        }
        tokenEnvVar = tokenEnvVar.substring(start, end);
    }
    
    if (channelPieces) {
        channelPieces[fullAlias] = [`https://${condaSplitUrl[1]}`, tokenEnvVar];
    }
}

function iterateThroughChannels(channels: string[], alias: string, channelPieces: {}, usedMultichannels: Set<string>, 
            defaultsCalled: boolean, defaultChannels: string[] | undefined, restoreFreeChannel: boolean, 
            customChannels: {} | undefined, customMultiChannels: {} | undefined) {
    for (let i = 0; i < channels.length; i++) {
        const channel = channels[i];
        if ((channel in channelPieces) || (`${alias}/${channel}` in channelPieces) || 
            (customChannels && (`${customChannels[channel]}/${channel}` in channelPieces)) || 
            (channel in usedMultichannels) || 
            ((channel === 'defaults') && defaultsCalled)) {
            // Throw warning that the same channel is listed multiple times
            console.warn(tl.loc('DuplicateChannel', 
                `${channel} or ${alias}/${channel} or ${customChannels[channel]}/${channel}`));
            continue;
        }
        if (channel.includes('@')) {
            getAliasPieces(channel, channelPieces);
        }
        else if (channel === 'defaults') {
            defaultsCalled = true;
            if (!defaultChannels) {
                defaultChannels = ['main', 'r', 'msys2'];
                if (restoreFreeChannel) {
                    defaultChannels.splice(1, 0, 'free');
                }
            }
            iterateThroughChannels(defaultChannels, alias, channelPieces, usedMultichannels, defaultsCalled, undefined,
                restoreFreeChannel, customChannels, customMultiChannels)
        }
        else if (customMultiChannels && (channel in customMultiChannels)) {
            // Create set for used custom multichannels
            usedMultichannels.add(channel);
            const customChannelsList = customMultiChannels[channel];
            iterateThroughChannels(customChannelsList, '', channelPieces, usedMultichannels, defaultsCalled, defaultChannels, 
                restoreFreeChannel, undefined, undefined);
        }
        else if (customChannels && (channel in customChannels)) {
            getAliasPieces(`${customChannels[channel]}/${channel}`, channelPieces);
        }
        else if (alias) {
            // Append channel to the end of alias
            // Entries:  <full channel str> : [<half after '@' symbol>, <TOKEN_ENV_VAR>]
            getAliasPieces(`${alias}/${channel}`, channelPieces);
        }
    }
}