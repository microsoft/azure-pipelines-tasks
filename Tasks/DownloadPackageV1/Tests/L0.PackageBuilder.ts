import * as assert from 'assert';
import { PackageUrlsBuilder } from '../packagebuilder';
import { SingleFilePackage } from '../singlefilepackage';
import { MultiFilePackage } from '../multifilepackage';

describe('DownloadPackageV1 L0 Suite - PackageBuilder Unit Behavior', function () {
    it('maps nuget to single-file package with .nupkg extension', async () => {
        const builder = new PackageUrlsBuilder().ofType('nuget');
        const pkg = await builder.build();

        assert.strictEqual(builder.PackageProtocolAreaName, 'NuGet');
        assert.strictEqual(builder.Extension, '.nupkg');
        assert(pkg instanceof SingleFilePackage);
    });

    it('maps npm to single-file package with .tgz extension', async () => {
        const builder = new PackageUrlsBuilder().ofType('npm');
        const pkg = await builder.build();

        assert.strictEqual(builder.PackageProtocolAreaName, 'npm');
        assert.strictEqual(builder.Extension, '.tgz');
        assert(pkg instanceof SingleFilePackage);
    });

    it('maps maven and pypi to multi-file package', async () => {
        const mavenBuilder = new PackageUrlsBuilder().ofType('maven');
        const pypiBuilder = new PackageUrlsBuilder().ofType('pypi');

        const mavenPackage = await mavenBuilder.build();
        const pypiPackage = await pypiBuilder.build();

        assert(mavenPackage instanceof MultiFilePackage);
        assert(pypiPackage instanceof MultiFilePackage);
    });

    it('builds maven route params with artifact path and fallback groupId', () => {
        const builder = new PackageUrlsBuilder().ofType('maven');
        const routeParams = builder.GetRouteParams(
            'feedId',
            'projectId',
            {
                protocolMetadata: {
                    data: {
                        groupId: undefined,
                        parent: { groupId: 'com.example' },
                        artifactId: 'demo-artifact',
                        version: '1.2.3'
                    }
                }
            },
            { name: 'demo-artifact-1.2.3.pom' }
        );

        assert.strictEqual(routeParams.feed, 'feedId');
        assert.strictEqual(routeParams.project, 'projectId');
        assert.strictEqual(routeParams.path, 'com.example/demo-artifact/1.2.3/demo-artifact-1.2.3.pom');
    });

    it('builds python route params from protocol metadata', () => {
        const builder = new PackageUrlsBuilder().ofType('pypi');
        const routeParams = builder.GetRouteParams(
            'feedId',
            'projectId',
            {
                protocolMetadata: {
                    data: {
                        name: 'wheelpkg',
                        version: '0.5.0'
                    }
                }
            },
            { name: 'wheelpkg-0.5.0-py3-none-any.whl' }
        );

        assert.strictEqual(routeParams.feedId, 'feedId');
        assert.strictEqual(routeParams.project, 'projectId');
        assert.strictEqual(routeParams.packageName, 'wheelpkg');
        assert.strictEqual(routeParams.packageVersion, '0.5.0');
        assert.strictEqual(routeParams.fileName, 'wheelpkg-0.5.0-py3-none-any.whl');
    });

    it('throws for unsupported package type', () => {
        assert.throws(() => new PackageUrlsBuilder().ofType('invalid-type'));
    });

    it('maps cargo to single-file package with .crate extension', async () => {
        const builder = new PackageUrlsBuilder().ofType('cargo');
        const pkg = await builder.build();

        assert.strictEqual(builder.PackageProtocolAreaName, 'Cargo');
        assert.strictEqual(builder.Extension, '.crate');
        assert(pkg instanceof SingleFilePackage);
    });

    it('exposes correct area IDs for nuget', () => {
        const builder = new PackageUrlsBuilder().ofType('nuget');

        assert.strictEqual(builder.PackagingMetadataAreaId, '7A20D846-C929-4ACC-9EA2-0D5A7DF1B197');
        assert.strictEqual(builder.PackageProtocolDownloadAreadId, '6EA81B8C-7386-490B-A71F-6CF23C80B388');
    });

    it('exposes correct area IDs for npm', () => {
        const builder = new PackageUrlsBuilder().ofType('npm');

        assert.strictEqual(builder.PackagingMetadataAreaId, '7A20D846-C929-4ACC-9EA2-0D5A7DF1B197');
        assert.strictEqual(builder.PackageProtocolDownloadAreadId, '75CAA482-CB1E-47CD-9F2C-C048A4B7A43E');
    });

    it('builds maven route params with primary groupId when available', () => {
        const builder = new PackageUrlsBuilder().ofType('maven');
        const routeParams = builder.GetRouteParams(
            'feedId',
            'projectId',
            {
                protocolMetadata: {
                    data: {
                        groupId: 'org.primary',
                        parent: { groupId: 'org.parent' },
                        artifactId: 'my-lib',
                        version: '2.0.0'
                    }
                }
            },
            { name: 'my-lib-2.0.0.jar' }
        );

        assert.strictEqual(routeParams.path, 'org.primary/my-lib/2.0.0/my-lib-2.0.0.jar');
    });

    it('chains builder methods fluently', () => {
        const builder = new PackageUrlsBuilder();
        const result = builder
            .ofType('nuget')
            .matchingPattern(['*.nupkg'])
            .withRetries(async (op) => op());

        assert.strictEqual(result, builder, 'Builder methods should return the same instance');
        assert.deepStrictEqual(builder.Pattern, ['*.nupkg']);
    });
});