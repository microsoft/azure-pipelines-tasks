import request = require('request');
import q = require('q');

/**
 * Get a JWT access token from AAD
 * @param resource The resource to access (ex: https://microsoft/kusto)
 * @param clientId The GUID of the client requesting access (ex: 23d5b01c-3789-435d-9040-97b5791763c8)
 * @param clientSecret The API Key used to authenticate the client with AAD
 *
 * The adal-node package provide a similar functionality. Skipping adal-node because: 1) it's several MBs, 2) it also requires manually creating Promise
 */
export function getAccessToken(resource: string, clientId: string, clientSecret: string): q.Promise<string> {

    console.log("Requesting AAD access token for " + resource + " by client " + clientId);

    // AAD doc: https://docs.microsoft.com/en-us/azure/active-directory/develop/active-directory-protocols-oauth-service-to-service
    var deferral = q.defer<string>();
    request.post(
        "https://login.windows.net/microsoft.onmicrosoft.com/oauth2/token",
        {
            form: {
                "grant_type": "client_credentials",
                "client_id": clientId,
                "client_secret": clientSecret,
                "resource": resource
            }
        },
        function (error, response, body) {
            if (error) {
                deferral.reject(error);
            } else if (response.statusCode >= 400) {
                deferral.reject(new Error("HTTP error " + response.statusCode + " " + response.statusMessage + ": " + body));
            } else {
                // TODO: cache access_token until 5 minutes before expires_on
                deferral.resolve(JSON.parse(body).access_token);
            }
        });

    return deferral.promise;
}

/**
 * Generate a new GUID
 * Code from https://stackoverflow.com/a/2117523
 */
export function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}