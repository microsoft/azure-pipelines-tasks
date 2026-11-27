import { createRunner } from './L0Common';

createRunner({
    inputs: { buildType: 'current', downloadType: 'single', artifactName: 'drop' },
    variables: { AZURE_PIPELINES_DEDUP_WORKER_DOWNLOADS: ' TRUE ' }
}).run();
