import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import * as constants from './constants';
import * as util from 'azure-pipelines-tasks-packaging-common/util';
import * as pkgLocationUtils from 'azure-pipelines-tasks-packaging-common/locationUtilities';
import * as url from 'url';

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
        const condarcContents = condarcFile.split(/\r?\n/);

        const channelPieces = {};  //Entries:  <full channel str as listed> : [<half after '@' symbol>, <TOKEN_ENV_VAR>]

        let channelsIndex = -1;
        let channelsAlias = '';
        let defaultChannelsIndex = -1;
        let customChannelsIndex = -1;
        let customMultichannelsIndex = -1;
        let restoreFreeChannel = false;
        for (let i = 0; i < condarcContents.length; i++) {
            const line = condarcContents[i].trim();
            if (line.startsWith('channels:')) {
                channelsIndex = i;
            } else if (line.startsWith('channels_alias: ')) {
                const aliases = line.split(/\s+/);
                if (aliases.length !== 2) {
                    // Throw error for invalid format
                    throw new Error(tl.loc("InvalidCondarcFormat", 'channel_alias'));
                }
                channelsAlias = aliases[1].replace(/['"]+/g, '')
                getAliasPieces(channelsAlias);
            } else if (line.startsWith('default_channels:')) {
                defaultChannelsIndex = i;
            } else if (line.startsWith('custom_channels:')) {
                customChannelsIndex = i;
            } else if (line.startsWith('custom_multichannels:')) {
                customMultichannelsIndex = i;
            } else if (line.startsWith('restore_free_channel: ')) {
                const freeChannels = line.split(/\s+/);
                if (freeChannels.length !== 2) {
                    // Throw error for invalid format
                    throw new Error(tl.loc('InvalidCondarcFormat', 'restore_free_channel'));
                }
                restoreFreeChannel = (freeChannels[1] === 'true');
            }
        }

        if ((channelsIndex === -1) && (defaultChannelsIndex === -1)) {
            // Throw error for having no channels
            throw new Error(tl.loc('CondarcMissingChannels'));
        }

        const customChannels = {}; //Entries:  <channel-name>: <alias>
        const customMultichannels = {}; //Entries: <multichannel-name>: [<list of channels>]
        const usedMultichannels = new Set<string>();
        if (customChannelsIndex !== -1) {
            extractCustomChannels(customChannelsIndex + 1, condarcContents, customChannels)
        }
        if (customMultichannelsIndex !== -1) {
            extractCustomChannels(customMultichannelsIndex + 1, condarcContents, customMultichannels, customChannels);
        }
        let isdefaults = false;
        if (channelsIndex === -1) {
            isdefaults = true;
            channelsIndex = defaultChannelsIndex;
        }
        iterateThroughChannels(channelsIndex + 1, channelsAlias, condarcContents, channelPieces, customChannels, 
            customMultichannels, usedMultichannels, isdefaults, defaultChannelsIndex, restoreFreeChannel);

        if (Object.keys(channelPieces).length === 0) {
            // Throw error for having no channels
            throw new Error(tl.loc('CondarcMissingChannels'));
        }

        let packagingLocation: pkgLocationUtils.PackagingLocation;
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

        const localAccesstoken = tl.getVariable('System.AccessToken');
        let allChannels = '';
        
        Object.entries(channelPieces).forEach(
            ([key, value]) => {
                //Entries:  <full channel str with system access token replacing the placeholder env variable> : 
                //  [<half after '@' symbol>, <TOKEN_ENV_VAR>]
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

function getAliasPieces(fullAlias: string, channelPieces?: {}): void {
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

function iterateThroughChannels(start: number, alias: string, condarcContents: string[], channelPieces: {}, 
        customChannels: {}, customMultiChannels: {}, usedMultichannels: Set<string>, defaultsCalled: boolean = false, 
        defaultChannelsIndex: number = -1, restoreFreeChannel: boolean = false): void {
    for (let i = start; i < condarcContents.length; i++) {
        const channelListed = condarcContents[i].trim();
        if (!channelListed.startsWith('-')) {
            break;
        } 
        const channel = channelListed.substring(1).trim().replace(/['"]+/g, '');
        if ((channel in channelPieces) || (`${alias}/${channel}` in channelPieces) || 
            (customChannels[channel] in channelPieces) || (channel in usedMultichannels)) {
            // Throw warning that the same channel is listed multiple times
            console.warn(tl.loc('DuplicateChannel', `${channel} or ${alias}/${channel} or ${customChannels[channel]}`));
            continue;
        }
        if (channel.includes('@')) {
            getAliasPieces(channel, channelPieces);
        } 
        else if (channel === 'defaults') {
            // Keep track of if defaults were called already to avoid an infinite loop
            if (defaultsCalled) {
                console.log('Defaults multichannel was already used');
                console.warn(tl.loc('DuplicateChannel', 'defaults'));
                continue;
            }
            let defaultChannels = ['-main', '-r', '-msys2'];
            if (restoreFreeChannel) {
                defaultChannels.splice(1, 0, '-free');
            }
            if (defaultChannelsIndex !== -1) {
                iterateThroughChannels(defaultChannelsIndex + 1, alias, condarcContents, channelPieces, 
                    customChannels, customMultiChannels, usedMultichannels, true)
            } else {
                iterateThroughChannels(0, alias, defaultChannels, channelPieces, customChannels, 
                    customMultiChannels, usedMultichannels, true);
            }
        }
        else if (channel in customMultiChannels) {
            // Create set for used custom multichannels
            const customChannelsList = customMultiChannels[channel];
            customChannelsList.forEach(innerChannel => {
                const listedChannel = innerChannel.substring(1);
                if ((listedChannel.includes('@')) && !(listedChannel in channelPieces)) {
                    getAliasPieces(listedChannel, channelPieces);
                }
                else if ((listedChannel in customMultiChannels) && !(listedChannel in usedMultichannels)) {
                    iterateThroughChannels(0, '', customMultiChannels[listedChannel], channelPieces, customChannels,
                        customMultiChannels, usedMultichannels, defaultsCalled, defaultChannelsIndex, restoreFreeChannel);
                }
            })
            usedMultichannels.add(channel);
        }
        else if (channel in customChannels) {
            getAliasPieces(customChannels[channel], channelPieces);
        }
        else if (alias) {
            // Append channel to the end of alias
            // Entries:  <full channel str> : [<half after '@' symbol>, <TOKEN_ENV_VAR>]
            const fullChannel = `${alias}/${channel}`;
            getAliasPieces(fullChannel, channelPieces);
       }
    }
}

function extractCustomChannels(start: number, condarcContents: string[], customChannelsMap: {}, otherCustomMap?: {}): void {
    /* customChannelsMap holds the key-value pairs type of the current property
            If we are extracting custom channels this is <channel-name>: <alias>
            If we are extracting custom multichannels this is <multichannel-name>: '[<c1>,', '<c2>,', ... '<ci>]'
       otherCustomMap will only be defined when we are extracting custom multichannels, 
            and it holds the key-value pairs of the custom_channels property */
    for (let i = start; i < condarcContents.length; i++) {
        // <multi-channel name>: [<list of channels it includes>]
        // or  
        // <channel name>: <alias>
        const customLine = condarcContents[i];
        if (!customLine.trim() || (customLine.trimStart() === customLine)) {
            // Reached end of property
            break;
        }
        const customChannelPieces = customLine.trim().split(/\s+/)  // <channel-name>: <alias> or <multichannel name>: [c1, c2, ...]
        if (!otherCustomMap && (customChannelPieces.length !== 2)) {
            // Throw error for invalid format of custom_channels
            throw new Error(tl.loc('InvalidCondarcFormat', 'custom_channels'));
        }
        const lastPiece = customChannelPieces[customChannelPieces.length - 1];
        if (otherCustomMap && ((customChannelPieces.length < 2) || (customChannelPieces[1].length < 3) || 
              (customChannelPieces[1][0] !== '[') || (lastPiece.length < 2) || (lastPiece[lastPiece.length - 1] !== ']'))) {
            // Throw error for invalid format of custom_multichannels
            throw new Error(tl.loc('InvalidCondarcFormat', 'custom_multichannels'));
        }
        if ((customChannelPieces[0].length < 2) || (customChannelPieces[0][customChannelPieces[0].length - 1] !== ':')) {
            // Throw error for invalid format
            throw new Error(tl.loc('InvalidCondarcFormat', 'custom_channels or custom_multichannels'));
        }
        if (customChannelPieces[0] === 'defaults:') {
            // Throw error to define custom defaults with "default_channels"
            throw new Error(tl.loc('UseDefaultChannelsProperty'));
        }
        // Gets rid of the colon at the end of the channel's name
        const customChannelName = `${customChannelPieces[0].substring(0, customChannelPieces[0].length - 1)}`;
        if ((customChannelName in customChannelsMap) || (otherCustomMap && (customChannelName in otherCustomMap))) {
            // Throw error for custom channel already being defined (trying to define the same custom channel name multiple times)
            throw new Error(tl.loc('DuplicateCustomName'));
        }
        //////////////////////////////////////////////////////////
        // Creates the new entry for customChannelsMap
        if (!otherCustomMap) {
            // For the property custom_channels only
            const fullCustomChannel = `${customChannelPieces[1]}/${customChannelName}`;
            customChannelsMap[customChannelName] = fullCustomChannel;
            continue;
        }
        // For the property custom_multichannels only
        if (customChannelName in otherCustomMap) {
            throw new Error(tl.loc('DuplicateCustomName', customChannelName));
        }
        // Removes '[' character from beginning of customChannelPieces[1]
        customChannelPieces[1] = customChannelPieces[1].substring(1);
        customChannelPieces[customChannelPieces.length - 1] = lastPiece.replace(']', ',');
        const customMultichannelsList : string[] = [];
        for (let j = 1; j < customChannelPieces.length; j++) {
            const channel = customChannelPieces[j];
            if (channel[channel.length - 1] !== ',') {
                // Throw formating error for custom_multichannels
                throw new Error(tl.loc('InvalidCondarcFormat', 'custom_multichannels'));
            }
            customMultichannelsList.push(`-${channel.replace(/['"]+/g, '').substring(0, channel.length - 1)}`);
        }
        customMultichannelsList.forEach((listedChannel, index) => {
            const channel = listedChannel.substring(1);
            if (channel === customChannelName) {
                throw new Error(tl.loc('DuplicateCustomName', channel));
            }
            else if ((channel in customChannelsMap) && 
                     (checkForCircularMultichannels(customChannelsMap[channel], customChannelsMap, customChannelName))) {
                throw new Error(tl.loc('CircularMultichannel', channel));
            }
            //If the channel listed in the custom multichannel is a custom channel itself, swaps the channel name for the full channel
            if (channel in otherCustomMap) {
                customMultichannelsList.splice(index, 1, otherCustomMap[channel]);
            }
        })
        customChannelsMap[customChannelName] = customMultichannelsList;
    }
}

function checkForCircularMultichannels(channelsList: string[], multichannelsMap: {}, multichannelName: string): boolean {
    for (let i = 0; i < channelsList.length; i++) {
        const channel = channelsList[i];
        if (channel === multichannelName) {
            return true;
        }
        else if (channel in multichannelsMap) {
            return checkForCircularMultichannels(multichannelsMap[channel], multichannelsMap, multichannelName);
        }
    }
    return false;
}