import * as tl from "vsts-task-lib/task";

export class NuGetAuthInfo {
    constructor(
        public uriPrefixes: string[],
        public accessToken: string) {
    }
}

export function getSystemAccessToken(): string {
    tl.debug("Getting credentials for local feeds");
    let auth = tl.getEndpointAuthorization("SYSTEMVSSCONNECTION", false);
    if (auth.scheme === "OAuth") {
        tl.debug("Got auth token");
        return auth.parameters["AccessToken"];
    }
    else {
        tl.warning("Could not determine credentials to use for NuGet");
    }
}
