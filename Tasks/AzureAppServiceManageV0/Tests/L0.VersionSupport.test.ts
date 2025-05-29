import * as assert from 'assert';
import * as sinon from 'sinon';
import { KuduServiceUtils } from '../operations/KuduServiceUtils';

describe('KuduServiceUtils.installSiteExtensionsWithVersionSupport', () => {
    let kuduServiceMock: any;
    let utils: KuduServiceUtils;
    beforeEach(() => {
        kuduServiceMock = {
            getSiteExtensions: sinon.stub().resolves([]),
            getAllSiteExtensions: sinon.stub().resolves([
                { id: 'ext1', title: 'ext1' },
                { id: 'ext2', title: 'ext2' }
            ]),
            installSiteExtension: sinon.stub().resolves({ id: 'ext1', local_path: 'foo' }),
            installSiteExtensionWithVersion: sinon.stub().resolves({ id: 'ext1', local_path: 'foo' })
        };
        utils = new KuduServiceUtils(kuduServiceMock);
    });
    it('calls installSiteExtensionWithVersion for versioned input', async () => {
        await utils.installSiteExtensionsWithVersion(['ext1@1.2.3']);
        assert(kuduServiceMock.installSiteExtensionWithVersion.calledWith('ext1', '1.2.3'));
    });
    it('calls installSiteExtension for latest', async () => {
        await utils.installSiteExtensionsWithVersion(['ext1@latest']);
        assert(kuduServiceMock.installSiteExtension.calledWith('ext1'));
    });
    it('calls installSiteExtension for no version if not installed', async () => {
        kuduServiceMock.getSiteExtensions.resolves([]);
        await utils.installSiteExtensionsWithVersion(['ext2']);
        assert(kuduServiceMock.installSiteExtension.calledWith('ext2'));
    });
    it('does not call installSiteExtension for no version if already installed', async () => {
        kuduServiceMock.getSiteExtensions.resolves([{ id: 'ext2', local_path: 'bar' }]);
        await utils.installSiteExtensionsWithVersion(['ext2']);
        assert(kuduServiceMock.installSiteExtension.notCalled);
    });
});
