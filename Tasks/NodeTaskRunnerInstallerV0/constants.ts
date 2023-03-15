export const BASE_NODE_DISTRIBUTION_URL = 'https://nodejs.org/dist';

export const BASE_NODE_VERSIONS_URL = 'https://nodejs.org/dist/index.json';

export enum RunnerVersion {
    node6 = '6.17.1',
    node10 = '10.24.1'
}

export const NODE_INPUT_VERSIONS = {
    '6': RunnerVersion.node6,
    '10': RunnerVersion.node10
} as const;
