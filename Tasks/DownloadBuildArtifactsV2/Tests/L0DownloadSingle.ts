import { createRunner } from './L0Common';

createRunner({
    inputs: { buildType: 'current', downloadType: 'single', artifactName: 'drop', parallelizationLimit: ' 3 ', retryDownloadCount: '+2' }
}).run();
