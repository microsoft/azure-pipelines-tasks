import { createRunner } from './L0Common';

createRunner({
    inputs: { buildType: 'current', downloadType: 'specific', artifactName: '' },
    variables: { INVALID_ARTIFACT_NAMES: JSON.stringify(['../outside', '', 'a:b']) }
}).run();
