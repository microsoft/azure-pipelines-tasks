import { BuildDefinitionReference } from 'azure-devops-node-api/interfaces/BuildInterfaces';
import { api } from './api';

// We're caching pipelines since we assume they will not change during the plan execution.
export function fetchPipelines() {
    let cachedPipelines: BuildDefinitionReference[] = [];

    return async (): Promise<BuildDefinitionReference[]> => {
        if (cachedPipelines.length > 0) {
            return new Promise((resolve) => resolve(cachedPipelines));
        }
        try {
            cachedPipelines = await api.getDefinitions();

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


