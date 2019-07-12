export interface IWebAppDeploymentProvider{
    isDeploymentSuccess: boolean;
    PreDeploymentStep();
    DeployWebAppStep();
    UpdateDeploymentStatus();
}