export interface IWebAppDeploymentProvider{
    PreDeploymentStep();
    DeployWebAppStep();
    UpdateDeploymentStatus(isDeploymentSuccess: boolean);
}