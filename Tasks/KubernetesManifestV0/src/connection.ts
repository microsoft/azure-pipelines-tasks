import * as tl from "vsts-task-lib/task";
import * as path from "path";
import * as fs from "fs";
import * as utils from "./utils/FileHelper";
import kubectlutility = require("utility-common/kubectlutility");

export class Connection {

    public open() {
        let kubeconfig: string, kubeconfigFile: string;
        let kubernetesServiceConnection = tl.getInput("kubernetesServiceConnection", true);

        let authorizationType = tl.getEndpointDataParameter(kubernetesServiceConnection, 'authorizationType', true);

        if (!authorizationType || authorizationType === "Kubeconfig") {
            kubeconfig = kubectlutility.getKubeconfigForCluster(kubernetesServiceConnection);
        }
        else if (authorizationType === "ServiceAccount" || authorizationType === "AzureSubscription") {
            kubeconfig = kubectlutility.createKubeconfig(kubernetesServiceConnection);
        }

        kubeconfigFile = path.join(utils.getNewUserDirPath(), "config");
        fs.writeFileSync(kubeconfigFile, kubeconfig);
        tl.setVariable("KUBECONFIG", kubeconfigFile);
    }

    public close() {
        if (tl.getVariable("KUBECONFIG")) {
            tl.setVariable("KUBECONFIG", "");
        }
    }
}
