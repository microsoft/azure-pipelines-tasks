import { TaskParameters } from '../operations/TaskParameters';

export abstract class IWebAppDeploymentProvider{
    public abstract async PredeploymentStep();
    public abstract async DeployWebAppStep();
    public abstract async UpdateDeploymentStatus(isDeploymentSuccess: boolean);
}