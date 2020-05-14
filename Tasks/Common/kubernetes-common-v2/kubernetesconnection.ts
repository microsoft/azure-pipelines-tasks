import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import * as fs from 'fs';
import * as kubectlutility from './kubectlutility';

export class KubernetesConnection {
    public ignoreSSLErrors: boolean;
    private kubernetesServiceConnection: string;
    private tempDir: string;

    constructor(kubernetesServiceConnection: string, tempDir: string) {
        this.kubernetesServiceConnection = kubernetesServiceConnection;
        this.tempDir = tempDir;
    }

    public open() {
        let kubeconfig: string;
        let kubeconfigFile: string;
        const authorizationType = tl.getEndpointDataParameter(this.kubernetesServiceConnection, 'authorizationType', true);

        if (!authorizationType || authorizationType === 'Kubeconfig') {
            kubeconfig = kubectlutility.getKubeconfigForCluster(this.kubernetesServiceConnection);
        } else if (authorizationType === 'ServiceAccount' || authorizationType === 'AzureSubscription') {
            kubeconfig = kubectlutility.createKubeconfig(this.kubernetesServiceConnection);
        }

        kubeconfigFile = path.join(this.tempDir, 'config');
        fs.writeFileSync(kubeconfigFile, kubeconfig);
        tl.setVariable('KUBECONFIG', kubeconfigFile);
        this.ignoreSSLErrors = tl.getEndpointDataParameter(this.kubernetesServiceConnection, 'acceptUntrustedCerts', true) === 'true';
    }

    public close() {
        if (tl.getVariable('KUBECONFIG')) {
            tl.setVariable('KUBECONFIG', '');
        }
    }
}