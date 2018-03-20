import path = require('path');
import secureFilesCommon = require('securefiles-common/securefiles-common');
import tl = require('vsts-task-lib/task');
import helmcli from "./helmcli";

export async function downloadSecuredFile(secureFileId: string) : Promise<string> {
     // download decrypted contents
     var secureFileHelpers = new secureFilesCommon.SecureFileHelpers();
     let secureFilePath: string = await secureFileHelpers.downloadSecureFile(secureFileId);
     return secureFilePath;
}

export function addArguments(helmCli: helmcli, cacertPath: string, certPath: string, keyPath: string) : void {
    //path to TLS certificate file
    var tlsCert = "--tls-cert";
    //path to TLS CA certificate file
    var tlsCaCert = "--tls-ca-cert";
    //path to TLS key file
    var tlsCertKey = "--tls-key";
    //enable TLS for request and verify remote
    var tlsverifyRemote = "--tls-verify"
    var type = tl.loc("Client");

    if(helmCli.getCommand() == "init")
    {
        tlsverifyRemote = "--tiller-tls-verify";
        tlsCert = "--tiller-tls-cert";
        tlsCaCert = "--tls-ca-cert";
        tlsCertKey= "--tiller-tls-key";
        type = tl.loc("Tiller");
    }

    if(!cacertPath || !tl.exist(cacertPath)) {
        throw new Error(tl.loc("CertificateNotFound",  tl.loc("CA"), cacertPath));
    }

    if(!certPath || !tl.exist(certPath)) {
        throw new Error(tl.loc("CertificateNotFound",  type, cacertPath));
    }

    if(!keyPath || !tl.exist(keyPath)) {
        throw new Error(tl.loc("CertificateKeyNotFound",  type, cacertPath));
    }

    helmCli.addArgument(tlsverifyRemote);
    helmCli.addArgument(tlsCert + " "+ certPath);
    helmCli.addArgument(tlsCertKey+ " "+ keyPath);
    helmCli.addArgument(tlsCaCert+ " "+ cacertPath);
}

export function isTlsEnabled() : boolean{

    var cacert = tl.getInput("cacert");
    var certificate =   tl.getInput("certificate"); 
    var key =  tl.getInput("key");

    // all three required inputs provided
    if(cacert && certificate && key) {
        return true;
    }

    if(!cacert && !certificate && !key) {
        return false;
    }

    tl.warning("NotAllTlsInputsProvided");
    return false;
}

