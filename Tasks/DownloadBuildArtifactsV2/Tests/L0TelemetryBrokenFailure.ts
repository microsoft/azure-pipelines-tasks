import { createRunner } from './L0Common';

createRunner({
    inputs: { buildType: 'current', downloadType: 'single', artifactName: 'fails-with-http-error' },
    variables: { TELEMETRY_BROKEN: 'true' }
}).run();
