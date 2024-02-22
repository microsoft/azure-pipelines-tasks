import { Build } from 'azure-devops-node-api/interfaces/BuildInterfaces';
import { api } from './api';

const buildLogData = (build: Build) => `[Definition Name: ${build.definition?.name}, Build Number: ${build.buildNumber}, Build Id: ${build.id}]`;

export async function fetchBuildStatus(pipelineBuild: Build): Promise<Build> {
    const intervalInSeconds = 20;
    const maxRetries = 10;

    let retryCount = 0;

    const getBuildPromise = new Promise<Build>((resolve, reject) => {
        const interval = setInterval(
            async () => {
                try {
                    const res = await api.getBuild(pipelineBuild.id!);

                    clearInterval(interval);
                    resolve(res);
                }
                catch (err: any) {
                    if (['ETIMEDOUT', 'ECONNRESET'].includes(err.code) || err.response?.status >= 500) {
                        if (retryCount < maxRetries) {
                            retryCount++;
                            console.log(`Error verifying state of the ${buildLogData(pipelineBuild)} build, retry request. Retry count: ${retryCount} out of ${maxRetries}. Error message: ${err.message}`);

                            return;
                        } else {
                            console.error(`Error verifying state of the ${buildLogData(pipelineBuild)} build, retries limit reached. Cancel retries. Error message: ${err.message}`);
                        }
                    }

                    clearInterval(interval);

                    err.stack = `Error verifying build status. Stack: ${err.stack}`;
                    console.error(err.stack);
                    if (err.response?.data) {
                        console.error(`Error response data: ${err.response.data}`);
                    }

                    reject(err);
                }
            },
            intervalInSeconds * 1000
        );
    });

    return getBuildPromise;
}

export async function retryFailedJobsInBuild(pipelineBuild: Build): Promise<void> {
    try {
        await api.updateBuild(pipelineBuild.id!);
    }
    catch (err: any) {
        err.stack = `Error retrying failed jobs in build ${buildLogData(pipelineBuild)}. Error: ${err.stack}`;
        console.error(err.stack);
        if (err.response?.data) {
            console.error(err.response.data);
        }

        throw err;
    }
}
