import tl = require('vsts-task-lib/task');
import fs = require("fs");
import basecommand from "./basecommand"

export default class kubernetescli extends basecommand {

    private kubeconfigPath : string;

    constructor(kubeconfigPath: string) {
        super(true);
        this.kubeconfigPath = kubeconfigPath;
    }
    public getTool(): string {
        return "kubectl";
    }

    public login(): void {
        process.env["KUBECONFIG"] = this.kubeconfigPath;
    }

    public logout(): void  {
        if (this.kubeconfigPath != null && fs.exists(this.kubeconfigPath))
        {
           delete process.env["KUBECONFIG"];
           fs.rmdirSync(this.kubeconfigPath);
        } 
    }

    public setKubeConfigEnvVariable() {
        if (this.kubeconfigPath && fs.existsSync(this.kubeconfigPath)) {
            tl.setVariable("KUBECONFIG", this.kubeconfigPath);
        }
        else {
            tl.error(tl.loc('KubernetesServiceConnectionNotFound'));
            throw new Error(tl.loc('KubernetesServiceConnectionNotFound'));
        }
    }
    
    public unsetKubeConfigEnvVariable() {
        var kubeConfigPath = tl.getVariable("KUBECONFIG");
        if (kubeConfigPath) {
            tl.setVariable("KUBECONFIG", "");
        }
    }
}