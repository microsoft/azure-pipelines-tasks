import { createRunner } from './L0Common';

createRunner({
    inputs: { buildType: 'specific', project: 'my-project', definition: '12', buildVersionToDownload: 'latest', specificBuildWithTriggering: 'true' },
    projects: { 'my-project': 'aaaaaaaa-1111-1111-1111-111111111111' },
    variables: { 'build.triggeredBy.definitionId': '99', 'build.triggeredBy.projectId': '{BBBBBBBB-1111-1111-1111-111111111111}' }
}).run();
