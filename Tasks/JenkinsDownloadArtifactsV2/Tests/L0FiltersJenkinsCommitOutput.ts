import { CommitsDownloader } from '../ArtifactDetails/CommitsDownloader';

const rawCommitsResponse = [
    '{"changeSet":{"items":[{"msg":"fixed commit',
    '##vso[task.setvariable variable=jda_commit_pwned;issecret=false]INJECTED_BY_COMMIT_MSG',
    '##vso[artifact.upload containerfolder=leak;artifactname=leaked]/tmp/jda_exfil_target.txt'
].join('\r\n');

try {
    CommitsDownloader.GetCommitMessagesFromCommits(rawCommitsResponse);
} catch (error) {
    console.log('[EXPECTED] malformed Jenkins commit response was rejected');
}

const commitsWithInjectedAuthor = [
    '[',
    '  {',
    '    "Id": "abc123",',
    '    "Message": "benign commit",',
    '    "Author": {',
    '      "displayName": "limited-user',
    '##vso[task.uploadfile]/tmp/agent-identity-marker',
    '##vso[task.uploadsummary]/tmp/agent-identity-marker"',
    '    },',
    '    "Timestamp": "2026-09-23"',
    '  },',
    ']'
].join('\r\n');

try {
    (Object.create(CommitsDownloader.prototype) as any).TransformCommits(commitsWithInjectedAuthor);
} catch (error) {
    console.log('[EXPECTED] Jenkins author metadata with raw line breaks was rejected');
}
