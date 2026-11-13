import { createRunner } from './L0Common';

createRunner({
    inputs: {
        buildType: 'current',
        downloadType: 'single',
        artifactName: 'my-private-artifact',
        itemPattern: 'private-folder/**/*.pem',
        buildVersionToDownload: 'a value that somebody typed',
        checkDownloadedFiles: 'true',
        parallelizationLimit: '5',
        retryDownloadCount: '2'
    },
    variables: {
        'System.HostType': 'build',
        'System.JobId': '11111111-aaaa-bbbb-cccc-222222222222',
        'System.PlanId': '33333333-dddd-eeee-ffff-444444444444',
        'Agent.Version': '4.248.0',
        'Agent.OS': 'Linux',
        'Agent.OSArchitecture': 'X64',
        AZURE_PIPELINES_DEDUP_WORKER_THREADS: '2',
        AZURE_PIPELINES_DEDUP_WORKER_DOWNLOADS: '1'
    }
}).run();
