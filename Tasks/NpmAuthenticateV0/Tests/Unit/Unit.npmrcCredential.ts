import assert from 'assert';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { resolveServiceEndpointCredential } from '../../npmrcCredential';
import { normalizeRegistry, toNerfDart } from '../../npmauthutils';

describe('NpmAuthenticateV0 Unit - npmrcCredential', function () {
    const originalGetEndpointAuthorization = (tl as any).getEndpointAuthorization;
    const originalGetEndpointUrl = (tl as any).getEndpointUrl;
    const endpointId = 'UnitEndpoint';

    before(function () {
        tl.setResourcePath(path.join(__dirname, '..', '..', 'task.json'));
    });

    afterEach(function () {
        (tl as any).getEndpointAuthorization = originalGetEndpointAuthorization;
        (tl as any).getEndpointUrl = originalGetEndpointUrl;
    });

    it('throws when endpoint auth is missing', async () => {
        (tl as any).getEndpointAuthorization = () => {
            throw new Error('missing auth');
        };
        (tl as any).getEndpointUrl = () => 'https://registry.example.com/npm';

        try {
            await resolveServiceEndpointCredential(endpointId, normalizeRegistry, toNerfDart);
            assert.fail('Expected resolveServiceEndpointCredential to throw');
        } catch (error) {
            assert(String(error).includes('service connection'),
                `Expected error about service connection, got: ${error}`);
        }
    });

    it('throws when endpoint url is missing', async () => {
        (tl as any).getEndpointAuthorization = () => ({
            scheme: 'UsernamePassword',
            parameters: { username: 'u', password: 'p' }
        });
        (tl as any).getEndpointUrl = () => {
            throw new Error('missing url');
        };

        try {
            await resolveServiceEndpointCredential(endpointId, normalizeRegistry, toNerfDart);
            assert.fail('Expected resolveServiceEndpointCredential to throw');
        } catch (error) {
            assert(String(error).includes('URL for the service connection'),
                `Expected error about service connection URL, got: ${error}`);
        }
    });

    it('throws for unsupported auth scheme', async () => {
        (tl as any).getEndpointAuthorization = () => ({
            scheme: 'Certificate',
            parameters: {}
        });
        (tl as any).getEndpointUrl = () => 'https://registry.example.com/npm';

        try {
            await resolveServiceEndpointCredential(endpointId, normalizeRegistry, toNerfDart);
            assert.fail('Expected resolveServiceEndpointCredential to throw');
        } catch (error) {
            assert(String(error).includes('Unsupported auth scheme'));
        }
    });

    it('formats UsernamePassword credentials as basic auth lines', async () => {
        (tl as any).getEndpointAuthorization = () => ({
            scheme: 'UsernamePassword',
            parameters: {
                username: 'myuser',
                password: 'mypassword'
            }
        });
        (tl as any).getEndpointUrl = () => 'https://registry.example.com/npm';

        const credential = await resolveServiceEndpointCredential(endpointId, normalizeRegistry, toNerfDart);

        assert.strictEqual(credential.url, 'https://registry.example.com/npm/');
        assert(credential.auth.includes('username=myuser'));
        assert(credential.auth.includes(':_password='));
        assert(credential.auth.includes('email=myuser'));
        assert(credential.auth.includes('always-auth=true'));
    });
});
