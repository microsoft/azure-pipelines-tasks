import { createRunner } from './L0Common';

createRunner({
    inputs: { buildType: 'current', downloadType: 'single', artifactName: 'drop', checkDownloadedFiles: '\u0085 True \u2003' }
}).run();
