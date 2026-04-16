import * as assert from 'assert';
import { PackageFileResult } from '../package';

describe('DownloadPackageV1 L0 Suite - PackageFileResult Unit Behavior', function () {
    it('stores and exposes fileName, value, and isUrl for a URL-based result', () => {
        const result = new PackageFileResult('mypackage.nupkg', 'https://example.com/download', true);

        assert.strictEqual(result.FileName, 'mypackage.nupkg');
        assert.strictEqual(result.Value, 'https://example.com/download');
        assert.strictEqual(result.IsUrl, true);
    });

    it('stores and exposes fileName, value, and isUrl for a content-based result', () => {
        const result = new PackageFileResult('pom.xml', '<project>content</project>', false);

        assert.strictEqual(result.FileName, 'pom.xml');
        assert.strictEqual(result.Value, '<project>content</project>');
        assert.strictEqual(result.IsUrl, false);
    });

    it('handles empty strings in all fields', () => {
        const result = new PackageFileResult('', '', false);

        assert.strictEqual(result.FileName, '');
        assert.strictEqual(result.Value, '');
        assert.strictEqual(result.IsUrl, false);
    });

    it('handles special characters in file names', () => {
        const result = new PackageFileResult('@scope/package.tgz', 'https://example.com/dl', true);

        assert.strictEqual(result.FileName, '@scope/package.tgz');
    });
});
