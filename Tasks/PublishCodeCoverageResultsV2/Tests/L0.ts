import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';
import fs = require('fs');
import assert = require('assert');
import crypto = require('crypto');
import os = require('os');
import path = require('path');
import { HttpClient } from 'typed-rest-client/HttpClient';
import {
    CoveragePublicationMode,
    RawUploadContext,
    createBlockIds,
    createDeterministicRawCoverageSetId,
    getBlobUrl,
    getCoveragePublicationMode,
    getRawCoverageCapabilityUrl,
    parseCoveragePublicationMode,
    prepareRawCoverageBundle,
    uploadFile
} from 'azure-pipelines-tasks-coveragepublisher/coveragepublisher';

describe('PublishCodeCoverageResultsV2 Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    before(() => {
        process.env.AGENT_TEMPDIRECTORY = process.cwd();
    });

    it('uses ReportGenerator when the capability endpoint is unavailable', async function() {
        const tr = await runTaskFixture('L0FeatureFlagDisabled.js');
        assert(tr.succeeded, 'task should have succeeded');
        assert.strictEqual(tr.invokedToolCount, 1, 'ReportGenerator should run in legacy-only mode');
    });

    it('keeps ReportGenerator outputs in additive mode', async function() {
        const tr = await runTaskFixture('L0Additive.js');
        assert(tr.succeeded, 'task should have succeeded');
        assert.strictEqual(tr.invokedToolCount, 1, 'ReportGenerator should run in additive mode');
    });

    it('does not run ReportGenerator in explicitly authorized raw-only mode', async function() {
        const tr = await runTaskFixture('L0SummaryFileLocationMatches.js');
        assert(tr.succeeded, 'task should have succeeded');
        assert.strictEqual(tr.invokedToolCount, 0, 'ReportGenerator should not run in raw-only mode');
    });

    it('keeps additive upload failures nonfatal and does not upload a manifest', async function() {
        const tr = await runTaskFixture('L0AdditiveUploadFailure.js');
        assert(tr.succeeded, 'task should have succeeded');
        assert.strictEqual(tr.invokedToolCount, 1, 'ReportGenerator should run after an additive upload failure');
        assert(tr.warningIssues.some(issue => issue.includes('RawCoverageUploadFailedAdditive')));
    });

    it('makes raw-only upload failures fatal and does not run ReportGenerator', async function() {
        const tr = await runTaskFixture('L0RawOnlyUploadFailure.js');
        assert(tr.failed, 'task should have failed');
        assert.strictEqual(tr.invokedToolCount, 0, 'ReportGenerator should not run after a raw-only upload failure');
    });

    it('falls back to legacy-only for 404 and invalid capability responses', async function() {
        const unavailableClient = createCapabilityClient(404, '');
        const malformedClient = createCapabilityClient(200, '{');
        const invalidClient = createCapabilityClient(200, JSON.stringify({
            contractVersion: '1.0',
            acceptedSchemaMajorVersions: [2],
            supportedModes: ['raw-authoritative']
        }));

        assert.strictEqual(
            await getCoveragePublicationMode(unavailableClient, 'https://dev.azure.com/example/', 'project-id', 'token'),
            CoveragePublicationMode.LegacyOnly);
        assert.strictEqual(
            await getCoveragePublicationMode(malformedClient, 'https://dev.azure.com/example/', 'project-id', 'token'),
            CoveragePublicationMode.LegacyOnly);
        assert.strictEqual(
            await getCoveragePublicationMode(invalidClient, 'https://dev.azure.com/example/', 'project-id', 'token'),
            CoveragePublicationMode.LegacyOnly);
    });

    it('maps the exact current server contract shadow mode to additive', function() {
        assert.strictEqual(parseCoveragePublicationMode({
            contractVersion: '1.0',
            acceptedSchemaMajorVersions: [1],
            supportedModes: ['shadow']
        }), CoveragePublicationMode.Additive);
    });

    it('maps raw-authoritative to raw-only only when explicitly advertised', function() {
        assert.strictEqual(parseCoveragePublicationMode({
            contractVersion: '1.0',
            acceptedSchemaMajorVersions: [1],
            supportedModes: ['shadow', 'raw-authoritative']
        }), CoveragePublicationMode.RawOnly);
        assert.strictEqual(parseCoveragePublicationMode({
            contractVersion: '1.0',
            acceptedSchemaMajorVersions: [1],
            supportedModes: ['shadow']
        }), CoveragePublicationMode.Additive);
        assert.strictEqual(parseCoveragePublicationMode({
            contractVersion: '1.0',
            acceptedSchemaMajorVersions: [1],
            supportedModes: ['unknown']
        }), CoveragePublicationMode.LegacyOnly);
        assert.strictEqual(parseCoveragePublicationMode({
            contractVersion: '2.0',
            acceptedSchemaMajorVersions: [1],
            supportedModes: ['raw-authoritative']
        }), CoveragePublicationMode.LegacyOnly);
    });

    it('uses the exact project-scoped Test Results capability endpoint', function() {
        const capabilityUrl = getRawCoverageCapabilityUrl(
            'https://vstmr.example.test/',
            '00000000-0000-0000-0000-000000000001');
        assert.strictEqual(
            capabilityUrl.pathname,
            '/00000000-0000-0000-0000-000000000001/_apis/testresults/codecoverage/rawcoveragebundle/capabilities');
        assert.strictEqual(capabilityUrl.searchParams.get('api-version'), '7.2-preview.1');
    });

    it('deduplicates identical content while preserving origins and pattern provenance', async function() {
        await withTempDirectory(async root => {
            const firstDirectory = path.join(root, 'first');
            const secondDirectory = path.join(root, 'second');
            fs.mkdirSync(firstDirectory);
            fs.mkdirSync(secondDirectory);
            const first = path.join(firstDirectory, 'coverage.xml');
            const second = path.join(secondDirectory, 'coverage.xml');
            fs.writeFileSync(first, 'same');
            fs.writeFileSync(second, 'same');

            const prepared = await prepareRawCoverageBundle([
                { filePath: first, sourcePatternIndexes: [0] },
                { filePath: second, sourcePatternIndexes: [1, 0] }
            ], undefined, createRawUploadContext(root));

            assert.strictEqual(prepared.blobs.length, 1);
            assert.strictEqual(prepared.manifest.entries.length, 1);
            assert.strictEqual(prepared.manifest.entries[0].byteLength, 4);
            assert.strictEqual(prepared.manifest.entries[0].sha256, crypto.createHash('sha256').update('same').digest('hex'));
            assert.deepStrictEqual(prepared.manifest.entries[0].sourcePatternIndexes, [0, 1]);
            assert.strictEqual(prepared.manifest.entries[0].origins.length, 2);
            assert(prepared.manifest.entries[0].origins.every(origin => origin.normalizedExtension === '.xml'));
        });
    });

    it('preserves same-basename files with different content', async function() {
        await withTempDirectory(async root => {
            const firstDirectory = path.join(root, 'first');
            const secondDirectory = path.join(root, 'second');
            fs.mkdirSync(firstDirectory);
            fs.mkdirSync(secondDirectory);
            const first = path.join(firstDirectory, 'coverage.xml');
            const second = path.join(secondDirectory, 'coverage.xml');
            fs.writeFileSync(first, 'first');
            fs.writeFileSync(second, 'second');

            const prepared = await prepareRawCoverageBundle([
                { filePath: first, sourcePatternIndexes: [0] },
                { filePath: second, sourcePatternIndexes: [1] }
            ], undefined, createRawUploadContext(root));

            assert.strictEqual(prepared.blobs.length, 2);
            assert(prepared.manifest.entries.every(entry => entry.originalName === 'coverage.xml'));
            assert.notStrictEqual(prepared.manifest.entries[0].blobPath, prepared.manifest.entries[1].blobPath);
        });
    });

    it('produces retry-stable set IDs, paths, and ordinals', async function() {
        await withTempDirectory(async root => {
            const first = path.join(root, 'a.xml');
            const second = path.join(root, 'b.xml');
            fs.writeFileSync(first, 'a');
            fs.writeFileSync(second, 'b');
            const context = createRawUploadContext(root);
            const firstAttempt = await prepareRawCoverageBundle([
                { filePath: first, sourcePatternIndexes: [0] },
                { filePath: second, sourcePatternIndexes: [1] }
            ], undefined, context, '2026-09-21T00:00:00.000Z');
            const retry = await prepareRawCoverageBundle([
                { filePath: second, sourcePatternIndexes: [1] },
                { filePath: first, sourcePatternIndexes: [0] }
            ], undefined, context, '2026-09-21T00:00:00.000Z');

            assert.strictEqual(firstAttempt.manifest.rawCoverageSetId, retry.manifest.rawCoverageSetId);
            assert.deepStrictEqual(
                firstAttempt.manifest.entries.map(entry => [entry.ordinal, entry.blobPath]),
                retry.manifest.entries.map(entry => [entry.ordinal, entry.blobPath]));
            assert.strictEqual(
                createDeterministicRawCoverageSetId(context.projectId, context.buildId, context.taskInstanceId),
                firstAttempt.manifest.rawCoverageSetId);
        });
    });

    it('classifies source roots without publishing unrestricted absolute paths', async function() {
        await withTempDirectory(async root => {
            const sourceRoot = path.join(root, 'src');
            const report = path.join(root, 'coverage.xml');
            fs.mkdirSync(sourceRoot);
            fs.writeFileSync(report, 'coverage');

            const prepared = await prepareRawCoverageBundle(
                [{ filePath: report, sourcePatternIndexes: [] }],
                sourceRoot,
                createRawUploadContext(root));

            assert.deepStrictEqual(prepared.manifest.sourceRoot, {
                kind: 'workspace-relative',
                path: 'src'
            });
            assert(!JSON.stringify(prepared.manifest).includes(root));
        });
    });

    it('hashes and uploads empty coverage files', async function() {
        await withTempDirectory(async root => {
            const report = path.join(root, 'empty.xml');
            fs.writeFileSync(report, '');
            const prepared = await prepareRawCoverageBundle(
                [{ filePath: report, sourcePatternIndexes: [0] }],
                undefined,
                createRawUploadContext(root));

            assert.strictEqual(prepared.manifest.entries[0].byteLength, 0);
            assert.strictEqual(
                prepared.manifest.entries[0].sha256,
                crypto.createHash('sha256').update('').digest('hex'));

            const requests: Array<{ method: string, body: string }> = [];
            const client = {
                put: async (_url: string, body: string) => {
                    requests.push({ method: 'PUT', body });
                    return successfulResponse();
                }
            } as unknown as HttpClient;
            await uploadFile(client, 'https://storage.example/container?sig=secret', 'empty.xml', report);
            assert.deepStrictEqual(requests, [{ method: 'PUT', body: '' }]);
        });
    });

    it('builds encoded blob URLs and fixed-width block IDs', function() {
        const blobUrl = getBlobUrl(
            'https://storage.example/container?sig=secret',
            'Intermediate/coverage/Raw/v1/set/blobs/hash/a file.xml');
        assert.strictEqual(
            blobUrl.pathname,
            '/container/Intermediate/coverage/Raw/v1/set/blobs/hash/a%20file.xml');
        assert.strictEqual(blobUrl.searchParams.get('sig'), 'secret');
        assert.deepStrictEqual(
            createBlockIds((4 * 1024 * 1024) + 1),
            [
                Buffer.from('00000000').toString('base64'),
                Buffer.from('00000001').toString('base64')
            ]);
    });

    it('runs the existing empty-results fixture', async function() {
        const tr = await runTaskFixture('L0NotFailWithEmptyResults.js');
        assert(tr.succeeded, 'task should have succeeded');
    });
});

async function runTaskFixture(fileName: string): Promise<MockTestRunner> {
    const tr = new MockTestRunner(path.join(__dirname, fileName));
    await tr.runAsync();
    return tr;
}

function createCapabilityClient(statusCode: number, body: string): HttpClient {
    return {
        get: async () => ({
            message: { statusCode },
            readBody: async () => body
        })
    } as unknown as HttpClient;
}

function createRawUploadContext(workingDirectory: string): RawUploadContext {
    return {
        collectionUri: 'https://dev.azure.com/example/',
        projectId: '00000000-0000-0000-0000-000000000001',
        buildId: 42,
        accessToken: 'token',
        taskInstanceId: '00000000-0000-0000-0000-000000000002',
        taskVersion: '2.281.0',
        workingDirectory
    };
}

async function withTempDirectory(action: (root: string) => Promise<void>): Promise<void> {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pccr-v2-'));
    try {
        await action(root);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

function successfulResponse() {
    return {
        message: { statusCode: 201 },
        readBody: async () => ''
    };
}
