import { createRunner } from './L0Common';

createRunner({
    inputs: { buildType: 'current', downloadType: 'single', artifactName: 'drop' },
    variables: { LOG_INJECTION: 'true' }
}).run();
