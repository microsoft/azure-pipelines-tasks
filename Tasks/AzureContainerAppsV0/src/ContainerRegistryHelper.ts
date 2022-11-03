import tl = require("azure-pipelines-task-lib/task");
import child = require("child_process")
import { CommandHelper } from "./CommandHelper";

export class ContainerRegistryHelper {
    /**
     * Authorizes Docker to make calls to the provided ACR instance using username and password.
     * @param acrName - the name of the ACR instance to authenticate calls to
     * @param acrUsername - the username for authentication
     * @param acrPassword - the password for authentication
     */
     public loginAcrWithUsernamePassword(acrName: string, acrUsername: string, acrPassword: string) {
        tl.debug(`Attempting to log in to ACR instance "${acrName}" with username and password credentials`);
        try {
            child.execSync(
                `docker login --password-stdin --username ${acrUsername} ${acrName}.azurecr.io`,
                { input: acrPassword });
        }
        catch (err) {
            tl.error(tl.loc("AcrUsernamePasswordAuthFailed", acrName));
            throw err;
        }
    }

    /**
     * Authorizes Docker to make calls to the provided ACR instance using an access token that is generated via
     * the 'az acr login --expose-token' command.
     * @param acrName - the name of the ACR instance to authenticate calls to.
     */
     public async loginAcrWithAccessTokenAsync(acrName: string) {
        tl.debug(`Attempting to log in to ACR instance "${acrName}" with access token`);
        try {
            let command: string = `CA_ADO_TASK_ACR_ACCESS_TOKEN=$(az acr login --name ${acrName} --output json --expose-token --only-show-errors | jq -r '.accessToken'); docker login ${acrName}.azurecr.io -u 00000000-0000-0000-0000-000000000000 -p $CA_ADO_TASK_ACR_ACCESS_TOKEN > /dev/null 2>&1`;
            await new CommandHelper().execBashCommandAsync(command);
        }
        catch (err) {
            tl.error(tl.loc("AcrAccessTokenAuthFailed", acrName));
            throw err;
        }
    }

    /**
     * Pushes an image to the ACR instance that was previously authenticated against.
     * @param imageToPush - the name of the image to push to ACR
     */
     public pushImageToAcr(imageToPush: string) {
        tl.debug(`Attempting to push image "${imageToPush}" to ACR`);
        try {
            tl.execSync("docker", `push ${imageToPush}`);
        }
        catch (err) {
            tl.error(tl.loc("PushImageToAcrFailed", imageToPush));
            throw err;
        }
    }
}