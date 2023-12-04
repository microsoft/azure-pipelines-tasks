import axios from "axios";
import { configInstance } from "./config";
import { API_VERSION } from "./constants";
import { PipelineBuild } from "./interfaces";

// We're caching pipelines since we assume they will not change during the plan execution.
export function fetchPipelines() {
    let cachedPipelines: PipelineBuild[] = [];

    return async (): Promise<PipelineBuild[]> => {
        if (cachedPipelines.length > 0) {
            return new Promise((resolve) => resolve(cachedPipelines));
        }
        try {
            const res = await axios
                .get(`${configInstance.ApiUrl}/pipelines?${API_VERSION}`, configInstance.AxiosAuth);
            cachedPipelines = res.data.value;

            return cachedPipelines;
        } catch (err: any) {
            err.stack = `Error fetching pipelines: ${err.stack}`;
            console.error(err.stack);
            if (err.response?.data) {
                console.error(err.response.data);
            }

            cachedPipelines = [];

            throw err;
        }
    }
}


