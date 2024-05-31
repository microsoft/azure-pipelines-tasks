import { oAuthToken } from "./SampleApiResponse";

export function setEnvVariables () {
    process.env['AGENT_VERSION'] = '3.237.0';
    process.env["SYSTEM_TEAMPROJECTID"] = "1";
    process.env["BUILD_BUILDID"] = "1";
    process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'] = 'https://example.visualstudio.com/defaultcollection';
    process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = JSON.stringify(oAuthToken);
}