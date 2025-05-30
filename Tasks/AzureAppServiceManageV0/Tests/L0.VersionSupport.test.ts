import * as assert from 'assert';
import { KuduServiceUtils } from '../operations/KuduServiceUtils';

describe('KuduServiceUtils.installSiteExtensionsWithVersionSupport', () => {
    let kuduServiceMock: any;
    let utils: KuduServiceUtils;
    let calls: any;
    beforeEach(() => {
        calls = {
            getSiteExtensions: [],
            getAllSiteExtensions: [],
            installSiteExtension: [],
            installSiteExtensionWithVersion: []
        };
        kuduServiceMock = {
            getSiteExtensions: async function() { calls.getSiteExtensions.push([...arguments]); return []; },
            getAllSiteExtensions: async function() { calls.getAllSiteExtensions.push([...arguments]); return [
                { id: 'ext1', title: 'ext1' },
                { id: 'ext2', title: 'ext2' }
            ]; },
            installSiteExtension: async function() { calls.installSiteExtension.push([...arguments]); return { id: 'ext1', local_path: 'foo' }; },
            installSiteExtensionWithVersion: async function() { calls.installSiteExtensionWithVersion.push([...arguments]); return { id: 'ext1', local_path: 'foo' }; }
        };
        utils = new KuduServiceUtils(kuduServiceMock);
    });
    it('calls installSiteExtensionWithVersion for versioned input', async () => {
        await utils.installSiteExtensionsWithVersion(['ext1@1.2.3']);
        assert.strictEqual(calls.installSiteExtensionWithVersion.length, 1, 'installSiteExtensionWithVersion should be called once');
        assert.deepStrictEqual(calls.installSiteExtensionWithVersion[0], ['ext1', '1.2.3']);
    });
    it('calls installSiteExtension for latest', async () => {
        await utils.installSiteExtensionsWithVersion(['ext1@latest']);
        assert.strictEqual(calls.installSiteExtension.length, 1, 'installSiteExtension should be called once');
        assert.deepStrictEqual(calls.installSiteExtension[0], ['ext1']);
    });
    it('calls installSiteExtension for no version if not installed', async () => {
        kuduServiceMock.getSiteExtensions = async function() { calls.getSiteExtensions.push([...arguments]); return []; };
        await utils.installSiteExtensionsWithVersion(['ext2']);
        assert.strictEqual(calls.installSiteExtension.length, 1, 'installSiteExtension should be called once');
        assert.deepStrictEqual(calls.installSiteExtension[0], ['ext2']);
    });
    it('does not call installSiteExtension for no version if already installed', async () => {
        kuduServiceMock.getSiteExtensions = async function() { calls.getSiteExtensions.push([...arguments]); return [{ id: 'ext2', local_path: 'bar' }]; };
        await utils.installSiteExtensionsWithVersion(['ext2']);
        assert.strictEqual(calls.installSiteExtension.length, 0, 'installSiteExtension should not be called');
    });
    it('skips installSiteExtension for @latest if local_is_latest_version is true', async () => {
        kuduServiceMock.getSiteExtensions = async function() {
            calls.getSiteExtensions.push([...arguments]);
            return [{ id: 'ext1', local_is_latest_version: true, local_path: 'foo' }];
        };
        await utils.installSiteExtensionsWithVersion(['ext1@latest']);
        assert.strictEqual(calls.installSiteExtension.length, 0, 'installSiteExtension should not be called');
    });
    it('calls installSiteExtension for @latest if local_is_latest_version is false', async () => {
        kuduServiceMock.getSiteExtensions = async function() {
            calls.getSiteExtensions.push([...arguments]);
            return [{ id: 'ext1', local_is_latest_version: false, local_path: 'foo' }];
        };
        await utils.installSiteExtensionsWithVersion(['ext1@latest']);
        assert.strictEqual(calls.installSiteExtension.length, 1, 'installSiteExtension should be called');
        assert.deepStrictEqual(calls.installSiteExtension[0], ['ext1']);
    });
    it('skips installSiteExtension for @latest if python-prefixed extension is at latest', async () => {
        kuduServiceMock.getSiteExtensions = async function() {
            calls.getSiteExtensions.push([...arguments]);
            return [{ id: 'azureappservice-ext1', local_is_latest_version: true, local_path: 'foo' }];
        };
        await utils.installSiteExtensionsWithVersion(['ext1@latest']);
        assert.strictEqual(calls.installSiteExtension.length, 0, 'installSiteExtension should not be called');
    });
    it('calls installSiteExtension for @latest if python-prefixed extension is not at latest', async () => {
        kuduServiceMock.getSiteExtensions = async function() {
            calls.getSiteExtensions.push([...arguments]);
            return [{ id: 'azureappservice-ext1', local_is_latest_version: false, local_path: 'foo' }];
        };
        await utils.installSiteExtensionsWithVersion(['ext1@latest']);
        assert.strictEqual(calls.installSiteExtension.length, 1, 'installSiteExtension should be called');
        assert.deepStrictEqual(calls.installSiteExtension[0], ['ext1']);
    });
    it('skips installSiteExtensionWithVersion for versioned input if already installed at that version', async () => {
        kuduServiceMock.getSiteExtensions = async function() {
            calls.getSiteExtensions.push([...arguments]);
            return [{ id: 'ext1', version: '1.2.3', local_path: 'foo' }];
        };
        await utils.installSiteExtensionsWithVersion(['ext1@1.2.3']);
        assert.strictEqual(calls.installSiteExtensionWithVersion.length, 0, 'installSiteExtensionWithVersion should not be called');
    });
    it('calls installSiteExtensionWithVersion for versioned input if already installed at different version', async () => {
        kuduServiceMock.getSiteExtensions = async function() {
            calls.getSiteExtensions.push([...arguments]);
            return [{ id: 'ext1', version: '1.0.0', local_path: 'foo' }];
        };
        await utils.installSiteExtensionsWithVersion(['ext1@1.2.3']);
        assert.strictEqual(calls.installSiteExtensionWithVersion.length, 1, 'installSiteExtensionWithVersion should be called');
        assert.deepStrictEqual(calls.installSiteExtensionWithVersion[0], ['ext1', '1.2.3']);
    });
});
