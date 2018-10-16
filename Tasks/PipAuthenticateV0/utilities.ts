import { IRequestOptions } from 'typed-rest-client/Interfaces';
import * as url from 'url';
import * as vsts from 'vso-node-api';
import * as tl from 'vsts-task-lib/task';

export function getWebApi(serviceUri: string, accessToken: string): vsts.WebApi{
    const credentialHandler = vsts.getBasicHandler("vsts", accessToken);
    const options: IRequestOptions = {
        proxy: tl.getHttpProxyConfiguration(serviceUri),
    };
    return new vsts.WebApi(serviceUri, credentialHandler, options);
}

export async function getPyPiSimpleApiFromFeedId(feedConnection: vsts.WebApi, feedId: string): Promise<string> {
    const ApiVersion = "5.0";
    const PyPiAreaName = "pypi";
    const PypiAreaId = "93377a2c-f5fb-48b9-a8dc-7781441cabf1";

    // Getting url for pypi simple api using feed id
    const pypiUrl = await new Promise<string>((resolve, reject) => {
        let getVersioningDataPromise = feedConnection.vsoClient.getVersioningData(
            ApiVersion,
            PyPiAreaName,
            PypiAreaId,
            { feedId });
        getVersioningDataPromise.then((result) => {
            return resolve(result.requestUrl);
        });
        getVersioningDataPromise.catch((error) => {
            tl.debug(error);
            return reject(error);
        });
    });
    return pypiUrl;
}

export function formPipCompatibleUri(userName: string, password: string, uri: string): string{
    try{
        const authenticationString = userName + ":" + password;
        let parsedUrl = url.parse(uri);
        parsedUrl.auth = authenticationString;
        return url.format(parsedUrl);
    } catch (error){
        throw new Error(tl.loc("Error_FailedToParseFeedUrlAndAuth", error));
    }

}
