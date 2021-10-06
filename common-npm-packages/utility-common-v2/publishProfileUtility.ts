var parseString = require('xml2js').parseString;

export interface ScmCredentials {
    scmUri: string;
    username: string;
    password: string;
    applicationUrl: string;
}

export async function getSCMCredentialsFromPublishProfile(publishProfileXml: string): Promise<ScmCredentials> {
    let res;
    await parseString(publishProfileXml, (error, result) => {
        if(!!error) {
            throw new Error("Failed publish profile XML parsing " + error);
        }
        try {
            res = result.publishData.publishProfile[0].$;
        } catch (error) {
            throw new Error("Invalid publish profile: " + error);
        }
    });
    let credentials: ScmCredentials = {
        scmUri: res.publishUrl.split(":")[0],
        username: res.userName,
        password: res.userPWD,
        applicationUrl: res.destinationAppUrl
    };
    console.log(`${credentials.username}`);
    console.log(`${credentials.scmUri}`);
    if(credentials.scmUri.indexOf("scm") < 0) {
        throw new Error("Publish profile does not contain kudu URL");
    }
    credentials.scmUri = `https://${credentials.scmUri}`;
    this.applicationURL = res.destinationAppUrl;
    return credentials;
}