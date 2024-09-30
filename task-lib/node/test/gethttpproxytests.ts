import * as assert from 'assert';
import * as tl from '../_build/task';

enum ProxyEnvironmentEnum  {
    proxyUrl = 'AGENT_PROXYURL',
    proxyUsername = 'AGENT_PROXYUSERNAME',
    proxyPassword =  'AGENT_PROXYPASSWORD',
    proxyBypass = 'AGENT_PROXYBYPASSLIST'
}

describe('GetHttpProxyConfiguration Tests', () => {
    const proxyHost: string = 'proxy.example.com';
    const proxyPort: number = 8888;
    const proxyUrl: string = `http://${proxyHost}:${proxyPort}`;
    const proxyUsername: string = 'proxyUser';
    const proxyPassword: string = 'proxyPassword';
    const proxyByPass: string[] = ['http://bypass.example.com'];
    const formatedUrlWithoutCrednetials = proxyUrl;
    const fortmatedUrlWithCredentials = `http://${proxyUsername}:${proxyPassword}@${proxyHost}:${proxyPort}`;

    it('returns a valid proxy configuration if no credentials set', () => {
        process.env[ProxyEnvironmentEnum.proxyUrl] = proxyUrl;
        process.env[ProxyEnvironmentEnum.proxyBypass] = JSON.stringify(proxyByPass);
        const expected: tl.ProxyConfiguration = {
            proxyUrl: proxyUrl,
            proxyBypassHosts: proxyByPass,
            proxyUsername: undefined,
            proxyPassword: undefined,
            proxyFormattedUrl: formatedUrlWithoutCrednetials
        }
        const result = tl.getHttpProxyConfiguration();
        assert.deepStrictEqual(result, expected, 'it should have valid configuration');
    });

    it('returns valid proxy configuration if credentials set', () => {
        process.env[ProxyEnvironmentEnum.proxyUrl] = proxyUrl;
        process.env[ProxyEnvironmentEnum.proxyUsername] = proxyUsername;
        process.env[ProxyEnvironmentEnum.proxyPassword] = proxyPassword;
        process.env[ProxyEnvironmentEnum.proxyBypass] = JSON.stringify(proxyByPass);
        const expected: tl.ProxyConfiguration = {
            proxyUrl: proxyUrl,
            proxyBypassHosts: proxyByPass,
            proxyFormattedUrl: fortmatedUrlWithCredentials,
            proxyPassword: proxyPassword,
            proxyUsername: proxyUsername
        }
        const result = tl.getHttpProxyConfiguration();
        assert.deepStrictEqual(result, expected, 'it should have credentials in formatted url');
    });

    it('returns null if host should be bypassed', () => {
        process.env[ProxyEnvironmentEnum.proxyUrl] = proxyUrl;
        const result = tl.getHttpProxyConfiguration(proxyByPass[0]);
        assert.strictEqual(result, null, 'result should be null');
    });
})