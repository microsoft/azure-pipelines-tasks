import axios from "axios";
import { configInstance } from "./config";
import { API_VERSION } from "./constants";
import { PipelineBuild } from "./interfaces";

export async function fetchPipelines(): Promise<PipelineBuild[]> {
    try {
        const res = await axios
            .get(`${configInstance.ApiUrl}/pipelines?${API_VERSION}`, configInstance.AxiosAuth);

        return res.data.value;
    } catch (err: any) {
        err.stack = `Error fetching pipelines: ${err.stack}`;
        console.error(err.stack);
        if (err.response?.data) {
            console.error(err.response.data);
        }

        throw err;
    }
}
