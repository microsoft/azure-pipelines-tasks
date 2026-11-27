import { createRunner } from './L0Common';

createRunner({
    inputs: { buildType: 'current', downloadType: 'single', artifactName: 'drop' },
    variables: { 'DistributedTask.Agent.CaseInsensitiveArtifactMatchingFixEnabled': 'true' }
}).run();
