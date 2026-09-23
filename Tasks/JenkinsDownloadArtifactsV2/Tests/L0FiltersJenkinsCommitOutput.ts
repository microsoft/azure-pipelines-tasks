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
