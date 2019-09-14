import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import * as fs from 'fs';
import * as fileHelper from './utils/fileHelper';
import * as kubectlutility from 'kubernetes-common-v2/kubectlutility';

export class KubernetesConnection {
    public open() {
        let kubeconfig: string;
        let kubeconfigFile: string;
        const kubernetesServiceConnection = tl.getInput('kubernetesServiceConnection', true);
        const authorizationType = tl.getEndpointDataParameter(kubernetesServiceConnection, 'authorizationType', true);

        if (!authorizationType || authorizationType === 'Kubeconfig') {
            kubeconfig = kubectlutility.getKubeconfigForCluster(kubernetesServiceConnection);
        } else if (authorizationType === 'ServiceAccount' || authorizationType === 'AzureSubscription') {
            kubeconfig = kubectlutility.createKubeconfig(kubernetesServiceConnection);
        }

        kubeconfigFile = path.join(fileHelper.getTaskTempDir(), 'config');
        fs.writeFileSync(kubeconfigFile, kubeconfig);
        tl.setVariable('KUBECONFIG', kubeconfigFile);
    }

    public close() {
        if (tl.getVariable('KUBECONFIG')) {
            tl.setVariable('KUBECONFIG', '');
        }
    }
}