import { createRunner } from './L0Common';

Object.defineProperty(process, 'platform', { value: 'linux' });

createRunner({
    inputs: { buildType: 'current', downloadType: 'single', artifactName: 'drop', extractTars: 'true' }
}).run();
