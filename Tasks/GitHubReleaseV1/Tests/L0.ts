import * as path from 'path';
import * as assert from 'assert';

import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as tl from 'azure-pipelines-task-lib/task';
import * as sinon from 'sinon';

import { TestString } from './TestStrings';
import { Utility } from '../operations/Utility';

describe('GitHub service connection authentication', function() {
    let sandbox: sinon.SinonSandbox;
    let authorization: sinon.SinonStub;

    beforeEach(() => {
        sandbox = sinon.sandbox.create();
        authorization = sandbox.stub(tl, 'getEndpointAuthorization');
        sandbox.stub(tl, 'loc').callsFake((key: string, ...args: string[]) => [key, ...args].join(': '));
    });

    afterEach(() => {
        sandbox.restore();
    });

    [
        { scheme: 'PersonalAccessToken', parameter: 'accessToken' },
        { scheme: 'OAuth', parameter: 'AccessToken' },
        { scheme: 'Token', parameter: 'AccessToken' },
        { scheme: 'InstallationToken', parameter: 'AccessToken' }
    ].forEach(({ scheme, parameter }) => {
        it(`Extracts the token for ${scheme} connections`, () => {
            authorization.returns({ scheme, parameters: { [parameter]: 'test-token' } });

            assert.strictEqual(Utility.getGithubEndPointToken('connection'), 'test-token');
            assert(authorization.calledWithExactly('connection', false));
        });

        [undefined, ''].forEach(token => {
            it(`Rejects ${scheme} connections with a ${token === undefined ? 'missing' : 'empty'} token`, () => {
                authorization.returns({ scheme, parameters: { [parameter]: token } });

                assert.throws(() => Utility.getGithubEndPointToken('connection'),
                    /^Error: InvalidGitHubEndpoint: connection$/);
            });
        });
    });

    it('Rejects unsupported authentication schemes', () => {
        authorization.returns({ scheme: 'Basic', parameters: { AccessToken: 'test-token' } });

        assert.throws(() => Utility.getGithubEndPointToken('connection'),
            /^Error: InvalidEndpointAuthScheme: Basic$/);
    });

    it('Rejects missing endpoint authorization', () => {
        authorization.returns(null);

        assert.throws(() => Utility.getGithubEndPointToken('connection'),
            /^Error: InvalidGitHubEndpoint: connection$/);
    });
});

describe('GitHubReleaseTaskTests Suite', function() {
    this.timeout(60000);

    it('Validate delete action is called when action = delete.', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'DeleteActionL0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync()
        .then(() => {
            assert(tr.stdout.search(TestString.deleteActionKeyWord) >= 0, 'should have printed: ' + TestString.deleteActionKeyWord);
            done();
        });
    });

    it('Validate create action is called when action = create', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'CreateActionL0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync()
        .then(() => {
            assert(tr.stdout.search(TestString.createActionKeyWord) >= 0, 'should have printed: ' + TestString.createActionKeyWord);
            done();
        });
    });

    it('Validate create action is called when action = edit but no release is present for that tag.', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'EditActionL0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync()
        .then(() => {
            assert(tr.stdout.search(TestString.editActionKeyWord) >= 0, 'should have printed: ' + TestString.editActionKeyWord);
            done();
        });
    });

    it('Validate edit action is called when action = edit but a release is present for that tag.', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'EditAction2L0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync()
        .then(() => {
            assert(tr.stdout.search(TestString.editAction2KeyWord) >= 0, 'should have printed: ' + TestString.editAction2KeyWord);
            done();
        });
    });

    it('Validate delete action is called when action = Delete. Validating if action is case insensitive or not.', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'DeleteAction2L0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync()
        .then(() => {
            assert(tr.stdout.search(TestString.deleteAction2KeyWord) >= 0, 'should have printed: ' + TestString.deleteAction2KeyWord);
            done();
        });
    });

    it('Validate task fails with correct error when action = create and no tag is present.', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'CreateAction2L0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync()
        .then(() => {
            assert(tr.stdout.search(TestString.NoTagFoundKeyword) >= 0, 'should have printed: ' + TestString.NoTagFoundKeyword);
            done();
        });
    });

    it('Validate task fails with correct error when action input is invalid', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'InvalidActionL0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync()
        .then(() => {
            assert(tr.stdout.search(TestString.InvalidActionKeyword) >= 0, 'should have printed: ' + TestString.InvalidActionKeyword);
            done();
        });
    });

    it('Validate Utility class methods', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'UtilityL0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync()
        .then(() => {
            assert(tr.stdout.search(TestString.getReleaseNoteKeyword) >= 0, 'should have printed: ' + TestString.getReleaseNoteKeyword);
            assert(tr.stdout.search(TestString.invalidBranchNameKeyword) >= 0, 'should have printed: ' + TestString.invalidBranchNameKeyword);
            assert(tr.stdout.search(TestString.tagMatchingKeyword) >= 0, 'should have printed: ' + TestString.tagMatchingKeyword);
            assert(tr.stdout.search(TestString.parseHTTPHeaderLinkKeyword) >= 0, 'should have printed: ' + TestString.parseHTTPHeaderLinkKeyword);
            assert(tr.stdout.search(TestString.extractRepositoryOwnerAndNameKeyword) >= 0, 'should have printed: ' + TestString.extractRepositoryOwnerAndNameKeyword);
            assert(tr.stdout.search(TestString.extractRepoAndIssueIdKeyword) >= 0, 'should have printed: ' + TestString.extractRepoAndIssueIdKeyword);
            assert(tr.stdout.search(TestString.getFirstLineKeyword) >= 0, 'should have printed: ' + TestString.getFirstLineKeyword);
            done();
        });
    });

    it('Validate Helper class methods', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'HelperTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync()
        .then(() => {
            assert(tr.stdout.search(TestString.getTagForCreateActionKeyword) >= 0, 'should have printed: ' + TestString.getTagForCreateActionKeyword);
            assert(tr.stdout.search(TestString.getCommitShaFromTargetKeyword) >= 0, 'should have printed: ' + TestString.getCommitShaFromTargetKeyword);
            assert(tr.stdout.search(TestString.getReleaseIdForTagKeyword) >= 0, 'should have printed: ' + TestString.getReleaseIdForTagKeyword);
            done();
        });
    });

    it('Validate ChangeLog class methods', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'ChangeLogTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync()
        .then(() => {
            assert(tr.succeeded, 'ChangeLogTests.js should succeed and include issue-regex assertions.');
            assert(tr.stdout.search(TestString.allIssuesChangeLog) >= 0, 'should have printed: ' + TestString.allIssuesChangeLog);
            assert(tr.stdout.search(TestString.noCategoryChangeLog) >= 0, 'should have printed: ' + TestString.noCategoryChangeLog);
            assert(tr.stdout.search(TestString.issueFetchFailFastChangeLog) >= 0, 'should have printed: ' + TestString.issueFetchFailFastChangeLog);
            assert(tr.stdout.search("loc_mock_IssuesFetchError") >= 0, 'should have printed: loc_mock_IssuesFetchError');
            assert(tr.stdout.search("Tag Name: v1.2") >=0, 'should have printed: TagName: v1.2');
            assert(tr.stdout.search("Tag Name: pre_rel") >=0, 'should have printed: TagName: pre_rel');
            assert(tr.stdout.search("Tag Name: tagName") >=0, 'should have printed: TagName: tagName');
            done();
        });
    });

    it('Validate Action class methods', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'ActionTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync()
        .then(() => {
            assert(tr.stdout.search(TestString.createReleaseSuccessKeyword) >= 0, 'should have printed: ' + TestString.createReleaseSuccessKeyword);
            assert(tr.stdout.search(TestString.deleteReleaseSuccessKeyword) >= 0, 'should have printed: ' + TestString.deleteReleaseSuccessKeyword);
            done();
        });
    });
});
