import { createRunner } from './L0Common';

createRunner({
    inputs: { buildType: 'current', downloadType: 'single', artifactName: 'drop' },
    variables: { 'System.TeamProjectId': 'not-a-guid' }
}).run();
