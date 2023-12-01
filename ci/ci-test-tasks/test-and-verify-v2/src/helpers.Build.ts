import axios from "axios";

import { PipelineBuild } from "./interfaces";
import { API_VERSION } from "./constants";
import { configInstance } from "./config";

export async function fetchBuildStatus(pipelineBuild: PipelineBuild): Promise<PipelineBuild> {
    const intervalInSeconds = 20;
    const maxRetries = 10;

    let retryCount = 0;

    const getBuildPromise = new Promise<PipelineBuild>((resolve, reject) => {
        const interval = setInterval(
            async () => {
                try {
                    const res = await axios.get(pipelineBuild.url, configInstance.AxiosAuth);

                    clearInterval(interval);
                    resolve(res.data);
                }
                catch (err: any) {
                    if (['ETIMEDOUT', 'ECONNRESET'].includes(err.code) || err.response?.status >= 500) {
                        if (retryCount < maxRetries) {
                            retryCount++;
                            console.log(`Error verifying state of the [${pipelineBuild.name} ${pipelineBuild.id}] build, retry request. Retry count: ${retryCount}. Error message: ${err.message}`);

                            return;
                        } else {
                            console.error(`Error verifying state of the [${pipelineBuild.name} ${pipelineBuild.id}], maximum retries reached. Cancel retries. Error message: ${err.message}`);
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

export async function retryFailedJobsInBuild(pipelineBuild: PipelineBuild): Promise<void> {
    try {
        await axios.patch(
            `${configInstance.ApiUrl}/build/builds/${pipelineBuild.id}?retry=true&${API_VERSION}`, undefined,
            {
                ...configInstance.AxiosAuth,
                headers: { 'Content-Type': 'application/json' }
            }
        )
    }
    catch (err: any) {
        err.stack = `Error retrying failed jobs in build: ${err.stack}`;
        console.error(err.stack);
        if (err.response?.data) {
            console.error(err.response.data);
        }

        throw err;
    }
}
