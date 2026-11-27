import { createRunner } from './L0Common';

// Values of the environment that do not have the form that the agent gives them.
createRunner({
    inputs: { buildType: 'current', downloadType: 'single', artifactName: 'drop' },
    variables: {
        'System.HostType': 'my private host',
        'System.JobId': 'not a guid',
        'System.PlanId': 'p'.repeat(500),
        'Agent.Version': '1.2.3-private-build',
        'Agent.OS': 'PrivateOS',
        'Agent.OSArchitecture': 'private'
    }
}).run();
