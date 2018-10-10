import * as fs from "fs";
import * as path from "path";
import { IRequestOptions } from "typed-rest-client/Interfaces";
import * as vsts from "vso-node-api";
import * as tl from "vsts-task-lib/task";

export function getWebApi(serviceUri: string, accessToken: string): vsts.WebApi{
    const credentialHandler = vsts.getBasicHandler("vsts", accessToken);
    const options: IRequestOptions = {
        proxy: tl.getHttpProxyConfiguration(serviceUri),
    };
    return new vsts.WebApi(serviceUri, credentialHandler, options);
}

export async function getPyPiUploadApiFromFeedName(feedConnection: vsts.WebApi, feedId: string): Promise<string> {
    const ApiVersion = "5.0";
    const PyPiAreaName = "pypi";
    const PypiAreaId = "c7a75c1b-08ac-4b11-b468-6c7ef835c85e";
     // Getting url for pypi upload api using feed id
    const pypiUploadUrl = await new Promise<string>((resolve, reject) => {
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
    return pypiUploadUrl;
}

export function getPypircPath(): string {
    let pypircPath: string;
    if (tl.getVariable("PYPIRC_PATH")) {
        pypircPath = tl.getVariable("PYPIRC_PATH");
    }
    else {
       // tslint:disable-next-line:max-line-length
       let tempPath = tl.getVariable("Agent.BuildDirectory") || tl.getVariable("Agent.ReleaseDirectory") || process.cwd();
       tempPath = path.join(tempPath, "twineAuthenticate");
       tl.mkdirP(tempPath);
       let savePypircPath = fs.mkdtempSync(tempPath + path.sep);
       pypircPath = savePypircPath + path.sep + ".pypirc";
    }
    return pypircPath;
}
