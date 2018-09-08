"use strict";

import tl = require('vsts-task-lib/task');
import helmcli from "./helmcli";

export function addHelmTlsSettings(helmCli: helmcli) : void { 
        //path to TLS certificate file
        var tlsCert = "--tls-cert";
        //path to TLS CA certificate file
        var tlsCaCert = "--tls-ca-cert";
        //path to TLS key file
        var tlsCertKey = "--tls-key";
        //enable TLS for request
        var tls = "--tls"

        addTlsSetting(helmCli, tls, tlsCaCert, tlsCert, tlsCertKey);
}

export function addTillerTlsSettings(helmCli: helmcli) : void { 
        var tls = "--tiller-tls";
        var tlsCert = "--tiller-tls-cert";
        var tlsCaCert = "--tls-ca-cert";
        var tlsCertKey= "--tiller-tls-key";
        
        addTlsSetting(helmCli, tls, tlsCaCert, tlsCert, tlsCertKey);
}


function addTlsSetting(helmCli: helmcli, tlsFlag: string, tlsCaCertFlag: string, tlsCertFlag: string, tlsCertKeyFlag: string ) {

    var caCertFilePath = tl.getTaskVariable('CACERT_FILE_PATH');
    if (!(caCertFilePath && tl.exist(caCertFilePath))) {
        throw new Error(tl.loc("FileNotFound", caCertFilePath));
    }

    var certFilePath = tl.getTaskVariable('CERT_FILE_PATH');
    if (!(certFilePath && tl.exist(certFilePath))) {
        throw new Error(tl.loc("FileNotFound", certFilePath));
    }

    var keyFilePath = tl.getTaskVariable('KEY_FILE_PATH');
    if (!(keyFilePath && tl.exist(keyFilePath))) {
        throw new Error(tl.loc("FileNotFound", keyFilePath));
    }

    helmCli.addArgument(tlsFlag);
    helmCli.addArgument(tlsCaCertFlag);
    helmCli.addArgument("\""+caCertFilePath+"\"");
    helmCli.addArgument(tlsCertFlag);
    helmCli.addArgument("\""+certFilePath+"\"");
    helmCli.addArgument(tlsCertKeyFlag);
    helmCli.addArgument("\""+keyFilePath+"\"");
}