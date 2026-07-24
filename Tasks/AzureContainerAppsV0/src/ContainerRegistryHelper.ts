import * as tl from 'azure-pipelines-task-lib/task';
import * as child from 'child_process';
import { CommandHelper } from './CommandHelper';
import { Utility } from './Utility';

export class ContainerRegistryHelper {
    // Tracks the ACR login servers (e.g. "myregistry.azurecr.io") that this task has authenticated
    // Docker against so that the resulting credentials can be cleaned up when the task completes.
    private readonly authenticatedRegistries: Set<string> = new Set<string>();

    /**
     * Authorizes Docker to make calls to the provided ACR instance using username and password.
     * @param acrName - the name of the ACR instance to authenticate calls to
     * @param acrUsername - the username for authentication
     * @param acrPassword - the password for authentication
     */
     public loginAcrWithUsernamePassword(acrName: string, acrUsername: string, acrPassword: string) {
        tl.debug(`Attempting to log in to ACR instance "${acrName}" with username and password credentials`);
        const registry = `${acrName}.azurecr.io`;
        try {
            child.execFileSync('docker', [
                'login', '--password-stdin',
                '--username', acrUsername,
                registry
            ], { input: acrPassword });
            this.authenticatedRegistries.add(registry);
        } catch (err) {
            tl.error(tl.loc('AcrUsernamePasswordAuthFailed', acrName));
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
        const registry = `${acrName}.azurecr.io`;
        try {
            const tokenJson = child.execFileSync('az', [
                'acr', 'login',
                '--name', acrName,
                '--output', 'json',
                '--expose-token',
                '--only-show-errors'
            ], { encoding: 'utf8' });

            const accessToken = JSON.parse(tokenJson).accessToken;

            child.execFileSync('docker', [
                'login', '--password-stdin',
                '--username', '00000000-0000-0000-0000-000000000000',
                registry
            ], { input: accessToken, stdio: 'pipe' });
            this.authenticatedRegistries.add(registry);
        } catch (err) {
            tl.error(tl.loc('AcrAccessTokenAuthFailed', acrName));
            throw err;
        }
    }

    /**
     * Logs Docker out of every ACR instance that was authenticated against during this task run so that
     * registry credentials are not left behind in the Docker config on the agent. This is important for
     * self-hosted or reused agents where leftover credentials could be reused by later steps, jobs, or users.
     * Failures are logged as warnings and do not fail the task.
     */
    public logoutAcr() {
        for (const registry of this.authenticatedRegistries) {
            tl.debug(`Attempting to log Docker out of ACR instance "${registry}"`);
            try {
                child.execFileSync('docker', ['logout', registry], { stdio: 'pipe' });
            } catch (err) {
                tl.warning(tl.loc('AcrLogoutFailed', registry, err.message));
            }
        }

        this.authenticatedRegistries.clear();
    }

    /**
     * Pushes an image to the ACR instance that was previously authenticated against.
     * @param imageToPush - the name of the image to push to ACR
     */
     public pushImageToAcr(imageToPush: string) {
        tl.debug(`Attempting to push image "${imageToPush}" to ACR`);
        try {
            new Utility().throwIfError(
                tl.execSync('docker', `push ${imageToPush}`),
                tl.loc('PushImageToAcrFailed', imageToPush)
            );
        } catch (err) {
            tl.error(err.message);
            throw err;
        }
    }
}