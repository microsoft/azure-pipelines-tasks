import * as tl from "azure-pipelines-task-lib/task";
import * as fs from "fs";
import * as path from "path";


export default class ClusterConnection {
    private kubeConfigFilePath: string;
    private userDir: string;

    public ignoreSSLErrors: boolean;
    public nameSpace: string;

    constructor (userDir: string) {
        this.userDir = userDir;
    }
    
    public async open() {
        const kubeconfig = await this.getKubeKonfig();

        if (kubeconfig)
        {
            this.kubeConfigFilePath = path.join(this.userDir, "config");
            fs.writeFileSync(this.kubeConfigFilePath, kubeconfig);
            tl.setVariable["KUBECONFIG"] = this.kubeConfigFilePath;
            this.ignoreSSLErrors = tl.getEndpointDataParameter(kubeconfig, 'acceptUntrustedCerts', true) === 'true';
            this.nameSpace = tl.getEndpointDataParameter(kubeconfig, 'namespace', true);
        }
    }

    public close(): void {
        if (this.kubeConfigFilePath != null && fs.existsSync(this.kubeConfigFilePath))
        {
            if (tl.getVariable('KUBECONFIG')) {
                tl.setVariable('KUBECONFIG', '');
            }
           fs.unlinkSync(this.kubeConfigFilePath);
        }
    }

    private getClusterType(): any {
        var connectionType = tl.getInput("connectionType", true);
        var endpoint = tl.getInput("azureSubscriptionEndpoint")
        if (connectionType === "Azure Resource Manager" && endpoint) {
            return require("../clusters/armkubernetescluster")
        }
    
        return require("../clusters/generickubernetescluster")
    }

    private getKubeKonfig(): Promise<string> {
        return this.getClusterType().getKubeConfig().then(config => {
            return config;
        });
    }
}