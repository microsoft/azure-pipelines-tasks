import { createRunner } from './L0Common';

createRunner({
    inputs: { buildType: 'current', downloadType: 'single', artifactName: 'fails-with-custom-error' }
}).run();
