import * as tl from 'azure-pipelines-task-lib/task';
import * as child from 'child_process';
import { CommandHelper } from './CommandHelper';
import { Utility } from './Utility';

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
            child.execFileSync('docker', [
                'login', '--password-stdin',
                '--username', acrUsername,
                `${acrName}.azurecr.io`
            ], { input: acrPassword });
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
                'login',
                `${acrName}.azurecr.io`,
                '-u', '00000000-0000-0000-0000-000000000000',
                '-p', accessToken
            ], { stdio: 'pipe' });
        } catch (err) {
            tl.error(tl.loc('AcrAccessTokenAuthFailed', acrName));
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