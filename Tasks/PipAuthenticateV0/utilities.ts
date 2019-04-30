import * as url from 'url';
import * as tl from 'azure-pipelines-task-lib/task';

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
