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
});