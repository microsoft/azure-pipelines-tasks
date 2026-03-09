import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('PublishPipelineMetadataV0 Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);


    beforeEach(() => {
        // Clear all environment variables before each test
        delete process.env['metadata_test1'];
        delete process.env['metadata_test2'];
        delete process.env['metadata_lowercase'];
        delete process.env['METADATA_TEST2'];
        delete process.env['METADATA_UPPERCASE'];
        delete process.env['System.TeamFoundationCollectionUri'];
        delete process.env['System.TeamProject'];
        delete process.env['RESOURCE_URIS'];
        delete process.env['SYSTEM_ACCESSTOKEN'];
        delete process.env['MOCK_RESPONSE_STATUS_CODE'];
        delete process.env['MOCK_RESPONSE_STATUS_MESSAGE'];
        delete process.env['MOCK_RESPONSE_BODY'];
    });

    it('Should succeed when no metadata variables are present', async () => {
        console.log('TestCase: Should succeed when no metadata variables are present');

        const tp = path.join(__dirname, 'TestSetup.js');
        const tr = new ttm.MockTestRunner(tp);

        // Set required system variables
        process.env['System.TeamFoundationCollectionUri'] = 'https://dev.azure.com/testorg/';
        process.env['System.TeamProject'] = 'TestProject';
        process.env['SYSTEM_ACCESSTOKEN'] = 'test-token';

        // No metadata variables set

        await tr.runAsync();

        assert(tr.succeeded, 'Task should have succeeded');
        assert(tr.stdOutContained('Not pushing as no metadata found'), 'Should indicate no metadata found');
    });

    it('Should publish metadata with valid metadata variable and resource URIs', async () => {
        console.log('TestCase: Should publish metadata with valid metadata variable and resource URIs');

        const tp = path.join(__dirname, 'TestSetup.js');
        const tr = new ttm.MockTestRunner(tp);

        // Set required system variables
        process.env['System.TeamFoundationCollectionUri'] = 'https://dev.azure.com/testorg/';
        process.env['System.TeamProject'] = 'TestProject';
        process.env['SYSTEM_ACCESSTOKEN'] = 'test-token';
        process.env['RESOURCE_URIS'] = 'https://resource1.example.com,https://resource2.example.com';

        // Set metadata variable
        const metadataPayload = {
            name: 'test-attestation',
            metadata: {
                serializedPayload: '{"test": "data"}',
                description: 'Test description',
                humanReadableName: 'Test Attestation'
            }
        };
        process.env['metadata_test1'] = JSON.stringify(metadataPayload);

        // Mock successful response
        process.env['MOCK_RESPONSE_STATUS_CODE'] = '200';
        process.env['MOCK_RESPONSE_STATUS_MESSAGE'] = 'OK';

        await tr.runAsync();

        assert(tr.succeeded, 'Task should have succeeded');
        assert(tr.stdOutContained('Successfully pushed metadata to evidence store'), 'Should indicate success');
        assert(tr.stdOutContained('Request sent to:'), 'Should have sent request');
        assert(tr.stdOutContained('/_apis/deployment/attestationdetails?api-version=5.2-preview.1'), 'Should use correct API endpoint');
    });

    it('Should use resourceUris from metadata payload when provided', async () => {
        console.log('TestCase: Should use resourceUris from metadata payload when provided');

        const tp = path.join(__dirname, 'TestSetup.js');
        const tr = new ttm.MockTestRunner(tp);

        // Set required system variables
        process.env['System.TeamFoundationCollectionUri'] = 'https://dev.azure.com/testorg/';
        process.env['System.TeamProject'] = 'TestProject';
        process.env['SYSTEM_ACCESSTOKEN'] = 'test-token';
        process.env['RESOURCE_URIS'] = 'https://should-not-use.example.com';

        // Set metadata variable with custom resourceUris
        const metadataPayload = {
            name: 'test-attestation',
            resourceUris: ['https://custom-resource.example.com'],
            metadata: {
                serializedPayload: '{"test": "data"}'
            }
        };
        process.env['metadata_test1'] = JSON.stringify(metadataPayload);

        process.env['MOCK_RESPONSE_STATUS_CODE'] = '200';

        await tr.runAsync();

        assert(tr.succeeded, 'Task should have succeeded');
        assert(tr.stdOutContained('custom-resource.example.com'), 'Should use custom resource URI from payload');
    });

    it('Should skip metadata without name field', async () => {
        console.log('TestCase: Should skip metadata without name field');

        const tp = path.join(__dirname, 'TestSetup.js');
        const tr = new ttm.MockTestRunner(tp);

        // Set required system variables
        process.env['System.TeamFoundationCollectionUri'] = 'https://dev.azure.com/testorg/';
        process.env['System.TeamProject'] = 'TestProject';
        process.env['SYSTEM_ACCESSTOKEN'] = 'test-token';
        process.env['RESOURCE_URIS'] = 'https://resource1.example.com';

        // Set metadata variable without name
        const metadataPayload = {
            metadata: {
                serializedPayload: '{"test": "data"}'
            }
        };
        process.env['metadata_test1'] = JSON.stringify(metadataPayload);

        await tr.runAsync();

        assert(tr.succeeded, 'Task should have succeeded');
        assert(tr.stdOutContained('Not pushing metadata as no name found'), 'Should indicate no name found');
    });

    it('Should skip metadata without metadata field', async () => {
        console.log('TestCase: Should skip metadata without metadata field');

        const tp = path.join(__dirname, 'TestSetup.js');
        const tr = new ttm.MockTestRunner(tp);

        // Set required system variables
        process.env['System.TeamFoundationCollectionUri'] = 'https://dev.azure.com/testorg/';
        process.env['System.TeamProject'] = 'TestProject';
        process.env['SYSTEM_ACCESSTOKEN'] = 'test-token';
        process.env['RESOURCE_URIS'] = 'https://resource1.example.com';

        // Set metadata variable without metadata field
        const metadataPayload = {
            name: 'test-attestation'
        };
        process.env['metadata_test1'] = JSON.stringify(metadataPayload);

        await tr.runAsync();

        assert(tr.succeeded, 'Task should have succeeded');
        assert(tr.stdOutContained('Not pushing metadata as no metadata found'), 'Should indicate no metadata found');
    });

    it('Should skip metadata without serializedPayload', async () => {
        console.log('TestCase: Should skip metadata without serializedPayload');

        const tp = path.join(__dirname, 'TestSetup.js');
        const tr = new ttm.MockTestRunner(tp);

        // Set required system variables
        process.env['System.TeamFoundationCollectionUri'] = 'https://dev.azure.com/testorg/';
        process.env['System.TeamProject'] = 'TestProject';
        process.env['SYSTEM_ACCESSTOKEN'] = 'test-token';
        process.env['RESOURCE_URIS'] = 'https://resource1.example.com';

        // Set metadata variable without serializedPayload
        const metadataPayload = {
            name: 'test-attestation',
            metadata: {
                description: 'Test description'
            }
        };
        process.env['metadata_test1'] = JSON.stringify(metadataPayload);

        await tr.runAsync();

        assert(tr.succeeded, 'Task should have succeeded');
        assert(tr.stdOutContained('Not pushing metadata as no metadata.serializedPayload found'), 'Should indicate no serializedPayload found');
    });

    it('Should skip metadata without resource URIs', async () => {
        console.log('TestCase: Should skip metadata without resource URIs');

        const tp = path.join(__dirname, 'TestSetup.js');
        const tr = new ttm.MockTestRunner(tp);

        // Set required system variables
        process.env['System.TeamFoundationCollectionUri'] = 'https://dev.azure.com/testorg/';
        process.env['System.TeamProject'] = 'TestProject';
        process.env['SYSTEM_ACCESSTOKEN'] = 'test-token';
        // No RESOURCE_URIS set

        // Set metadata variable
        const metadataPayload = {
            name: 'test-attestation',
            metadata: {
                serializedPayload: '{"test": "data"}'
            }
        };
        process.env['metadata_test1'] = JSON.stringify(metadataPayload);

        await tr.runAsync();

        assert(tr.succeeded, 'Task should have succeeded');
        assert(tr.stdOutContained('Not pushing metadata as no resource Ids found'), 'Should indicate no resource IDs found');
    });

    it('Should handle multiple metadata variables', async () => {
        console.log('TestCase: Should handle multiple metadata variables');

        const tp = path.join(__dirname, 'TestSetup.js');
        const tr = new ttm.MockTestRunner(tp);

        // Set required system variables
        process.env['System.TeamFoundationCollectionUri'] = 'https://dev.azure.com/testorg/';
        process.env['System.TeamProject'] = 'TestProject';
        process.env['SYSTEM_ACCESSTOKEN'] = 'test-token';
        process.env['RESOURCE_URIS'] = 'https://resource1.example.com';

        // Set multiple metadata variables
        const metadataPayload1 = {
            name: 'test-attestation-1',
            metadata: {
                serializedPayload: '{"test": "data1"}'
            }
        };
        const metadataPayload2 = {
            name: 'test-attestation-2',
            metadata: {
                serializedPayload: '{"test": "data2"}'
            }
        };
        process.env['metadata_test1'] = JSON.stringify(metadataPayload1);
        process.env['metadata_test2'] = JSON.stringify(metadataPayload2);

        process.env['MOCK_RESPONSE_STATUS_CODE'] = '200';

        await tr.runAsync();

        assert(tr.succeeded, 'Task should have succeeded');
        assert(tr.stdOutContained('Successfully pushed metadata to evidence store'), 'Should indicate success');
    });

    it('Should handle invalid JSON in metadata variable gracefully', async () => {
        console.log('TestCase: Should handle invalid JSON in metadata variable gracefully');

        const tp = path.join(__dirname, 'TestSetup.js');
        const tr = new ttm.MockTestRunner(tp);

        // Set required system variables
        process.env['System.TeamFoundationCollectionUri'] = 'https://dev.azure.com/testorg/';
        process.env['System.TeamProject'] = 'TestProject';
        process.env['SYSTEM_ACCESSTOKEN'] = 'test-token';
        process.env['RESOURCE_URIS'] = 'https://resource1.example.com';

        // Set invalid JSON
        process.env['metadata_test1'] = 'invalid-json{{{';

        await tr.runAsync();

        assert(tr.succeeded, 'Task should have succeeded even with invalid JSON');
        assert(tr.stdOutContained('Failed to parse metadata for variable'), 'Should indicate parsing failure');
    });

    it('Should include optional fields in request when provided', async () => {
        console.log('TestCase: Should include optional fields in request when provided');

        const tp = path.join(__dirname, 'TestSetup.js');
        const tr = new ttm.MockTestRunner(tp);

        // Set required system variables
        process.env['System.TeamFoundationCollectionUri'] = 'https://dev.azure.com/testorg/';
        process.env['System.TeamProject'] = 'TestProject';
        process.env['SYSTEM_ACCESSTOKEN'] = 'test-token';
        process.env['RESOURCE_URIS'] = 'https://resource1.example.com';

        // Set metadata variable with all optional fields
        const metadataPayload = {
            name: 'test-attestation',
            metadata: {
                serializedPayload: '{"test": "data"}',
                description: 'Test description',
                humanReadableName: 'Test Human Readable Name',
                relatedUrl: [
                    { url: 'https://example.com', label: 'Example' }
                ]
            }
        };
        process.env['metadata_test1'] = JSON.stringify(metadataPayload);

        process.env['MOCK_RESPONSE_STATUS_CODE'] = '200';

        await tr.runAsync();

        assert(tr.succeeded, 'Task should have succeeded');
        assert(tr.stdOutContained('Test description'), 'Should include description');
        assert(tr.stdOutContained('Test Human Readable Name'), 'Should include humanReadableName');
        assert(tr.stdOutContained('relatedUrl'), 'Should include relatedUrl');
    });

    it('Should succeed even when API call fails', async () => {
        console.log('TestCase: Should succeed even when API call fails');

        const tp = path.join(__dirname, 'TestSetup.js');
        const tr = new ttm.MockTestRunner(tp);

        // Set required system variables
        process.env['System.TeamFoundationCollectionUri'] = 'https://dev.azure.com/testorg/';
        process.env['System.TeamProject'] = 'TestProject';
        process.env['SYSTEM_ACCESSTOKEN'] = 'test-token';
        process.env['RESOURCE_URIS'] = 'https://resource1.example.com';

        // Set metadata variable
        const metadataPayload = {
            name: 'test-attestation',
            metadata: {
                serializedPayload: '{"test": "data"}'
            }
        };
        process.env['metadata_test1'] = JSON.stringify(metadataPayload);

        // Mock failed response
        process.env['MOCK_RESPONSE_STATUS_CODE'] = '500';
        process.env['MOCK_RESPONSE_STATUS_MESSAGE'] = 'Internal Server Error';

        await tr.runAsync();

        // Task should still succeed (it handles errors gracefully)
        assert(tr.succeeded, 'Task should have succeeded even with API failure');
    });

    it('Should handle case-insensitive metadata variable names', async () => {
        console.log('TestCase: Should handle case-insensitive metadata variable names');

        const tp = path.join(__dirname, 'TestSetup.js');
        const tr = new ttm.MockTestRunner(tp);

        // Set required system variables
        process.env['System.TeamFoundationCollectionUri'] = 'https://dev.azure.com/testorg/';
        process.env['System.TeamProject'] = 'TestProject';
        process.env['SYSTEM_ACCESSTOKEN'] = 'test-token';
        process.env['RESOURCE_URIS'] = 'https://resource1.example.com';

        // Set metadata variables with different casing
        const metadataPayload1 = {
            name: 'test-attestation-1',
            metadata: {
                serializedPayload: '{"test": "data1"}'
            }
        };
        const metadataPayload2 = {
            name: 'test-attestation-2',
            metadata: {
                serializedPayload: '{"test": "data2"}'
            }
        };
        process.env['metadata_lowercase'] = JSON.stringify(metadataPayload1);
        process.env['METADATA_UPPERCASE'] = JSON.stringify(metadataPayload2);

        process.env['MOCK_RESPONSE_STATUS_CODE'] = '200';

        await tr.runAsync();

        assert(tr.succeeded, 'Task should have succeeded');
        assert(tr.stdOutContained('Successfully pushed metadata to evidence store'), 'Should indicate success');
    });

    it('Should construct correct API URL', async () => {
        console.log('TestCase: Should construct correct API URL');

        const tp = path.join(__dirname, 'TestSetup.js');
        const tr = new ttm.MockTestRunner(tp);

        // Set required system variables
        process.env['System.TeamFoundationCollectionUri'] = 'https://dev.azure.com/myorg/';
        process.env['System.TeamProject'] = 'MyProject';
        process.env['SYSTEM_ACCESSTOKEN'] = 'test-token';
        process.env['RESOURCE_URIS'] = 'https://resource1.example.com';

        // Set metadata variable
        const metadataPayload = {
            name: 'test-attestation',
            metadata: {
                serializedPayload: '{"test": "data"}'
            }
        };
        process.env['metadata_test1'] = JSON.stringify(metadataPayload);

        process.env['MOCK_RESPONSE_STATUS_CODE'] = '200';

        await tr.runAsync();

        assert(tr.succeeded, 'Task should have succeeded');
        assert(tr.stdOutContained('https://dev.azure.com/myorg/MyProject/_apis/deployment/attestationdetails?api-version=5.2-preview.1'),
            'Should construct correct API URL');
    });
});
