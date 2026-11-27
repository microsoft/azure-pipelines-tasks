import { createRunner } from './L0Common';

createRunner({
    inputs: { buildType: 'current', downloadType: 'single', artifactName: process.env['ARTIFACT_NAME_UNDER_TEST'] ?? '' }
}).run();
