// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createHash } from 'crypto';
import * as tl from 'azure-pipelines-task-lib/task';
import { resolveCiJar } from '../src/ciJarResolver';
import { layoutMavenRepo } from '../src/mavenLayout';

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

describe('GradleAuthenticate - CI JAR staging', () => {
    let tempDir: string;
    let jarPath: string;
    let originalOverride: string | undefined;
    const approvedContent = Buffer.from('approved-release-jar');

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gradle-jar-integrity-'));
        jarPath = path.join(tempDir, 'artifacts-gradle-credprovider-1.0.0.jar');
        fs.writeFileSync(jarPath, approvedContent);
        originalOverride = process.env['GRADLE_CREDPROVIDER_HOME'];
    });

    afterEach(() => {
        if (originalOverride === undefined) {
            delete process.env['GRADLE_CREDPROVIDER_HOME'];
        } else {
            process.env['GRADLE_CREDPROVIDER_HOME'] = originalOverride;
        }
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('stages the same resolved bytes for all versions even if the source is replaced', () => {
        process.env['GRADLE_CREDPROVIDER_HOME'] = tempDir;
        const { content } = resolveCiJar();
        fs.writeFileSync(jarPath, 'replacement-after-resolution');
        const repoDir = path.join(tempDir, 'repo');
        const versions = ['1.0.0', '2.0.0'];
        layoutMavenRepo(repoDir, content, versions);

        for (const version of versions) {
            const stagedJar = path.join(repoDir, 'com', 'microsoft', 'azure',
                'artifacts-gradle-credprovider', version, `artifacts-gradle-credprovider-${version}.jar`);
            assert.deepStrictEqual(fs.readFileSync(stagedJar), approvedContent);
        }
    });

    it('preserves custom overrides without requiring a release checksum', () => {
        process.env['GRADLE_CREDPROVIDER_HOME'] = tempDir;
        const resolved = resolveCiJar();
        assert.strictEqual(resolved.path, jarPath);
        assert.deepStrictEqual(resolved.content, approvedContent);
    });

    it('accepts the bundled provider with its pinned and included SHA-256', () => {
        delete process.env['GRADLE_CREDPROVIDER_HOME'];
        const resolved = resolveCiJar();
        const release: { jarSha256: string } = require('../data/credprovider-release.json');
        const checksum = createHash('sha256').update(resolved.content).digest('hex');
        const publishedChecksum = fs.readFileSync(`${resolved.path}.sha256`, 'utf8').trim().split(/\s+/)[0];

        assert.strictEqual(checksum, release.jarSha256);
        assert.strictEqual(checksum, publishedChecksum);
    });
});
