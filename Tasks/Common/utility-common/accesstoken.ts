import tl = require('vsts-task-lib/task');

export function getSystemAccessToken(): string {
    tl.debug('Getting credentials for account feeds');
    let auth = tl.getEndpointAuthorization('SYSTEMVSSCONNECTION', false);
    if (auth && auth.scheme === 'OAuth') {
        tl.debug('Got auth token');
        return auth.parameters['AccessToken'];
    }
    tl.warning(tl.loc('FeedTokenUnavailable'));
    return '';
}
