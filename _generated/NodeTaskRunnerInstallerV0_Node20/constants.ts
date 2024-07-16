export const BASE_NODE_DISTRIBUTION_URL = 'https://nodejs.org/dist';

export const BASE_NODE_VERSIONS_URL = 'https://nodejs.org/dist/index.json';

export enum RunnerVersion {
    node6 = '6.17.1',
    node10 = '10.24.1',
    node16 = '16.20.2'
}

export const RunnerFolder = {
    [RunnerVersion.node6]: 'node',
    [RunnerVersion.node10]: 'node10',
    [RunnerVersion.node16]: 'node16'
} as const;

export const NODE_INPUT_VERSIONS = {
    '6': RunnerVersion.node6,
    '10': RunnerVersion.node10,
    '16': RunnerVersion.node16
} as const;
