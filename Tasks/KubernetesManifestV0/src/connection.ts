import * as tl from "vsts-task-lib/task";
import * as path from "path";
import * as fs from "fs";
import * as utils from "./utils/FileHelper";
import kubectlutility = require("utility-common/kubectlutility");

export class Connection {

    constructor(skipAuth?: boolean) {
        this._skipAuth = !!skipAuth;
    }

    public open() {
        let connectionType = tl.getInput("connectionType", true);
        if (connectionType === "None" || this._skipAuth) {
            return;
        }

        let kubeconfig: string, kubeconfigFile: string;
        let kubernetesServiceEndpoint = tl.getInput("kubernetesServiceEndpoint", true);
        let authorizationType = tl.getEndpointDataParameter(kubernetesServiceEndpoint, 'authorizationType', true);

        if (!authorizationType || authorizationType === "Kubeconfig") {
            kubeconfig = kubectlutility.getKubeconfigForCluster(kubernetesServiceEndpoint);
        }
        else if (authorizationType === "ServiceAccount") {
            kubeconfig = kubectlutility.createKubeconfig(kubernetesServiceEndpoint);
        }

        kubeconfigFile = path.join(utils.getNewUserDirPath(), "config");
        fs.writeFileSync(kubeconfigFile, kubeconfig);
        tl.setVariable("KUBECONFIG", kubeconfigFile);
    }

    public close() {
        if (!this._skipAuth && tl.getVariable("KUBECONFIG")) {
            tl.setVariable("KUBECONFIG", "");
        }
    }

    private _skipAuth: boolean;
}
