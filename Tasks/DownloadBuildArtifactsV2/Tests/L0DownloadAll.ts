import { createRunner } from './L0Common';

createRunner({
    inputs: { buildType: 'current', downloadType: 'specific', artifactName: '', parallelizationLimit: '0', retryDownloadCount: '8x' }
}).run();
