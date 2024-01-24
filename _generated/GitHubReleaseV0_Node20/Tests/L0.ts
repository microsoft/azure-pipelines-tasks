import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TestString } from './TestStrings';

describe('GitHubReleaseTaskTests Suite', function() {
    this.timeout(60000);

    it('Validate delete action is called when action = delete.', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'DeleteActionL0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search(TestString.deleteActionKeyWord) >= 0, 'should have printed: ' + TestString.deleteActionKeyWord);

        done();
    });

    it('Validate create action is called when action = create', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'CreateActionL0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search(TestString.createActionKeyWord) >= 0, 'should have printed: ' + TestString.createActionKeyWord);
       
        done();
    });

    it('Validate create action is called when action = edit but no release is present for that tag.', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'EditActionL0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search(TestString.editActionKeyWord) >= 0, 'should have printed: ' + TestString.editActionKeyWord);
        
        done();
    });

    it('Validate edit action is called when action = edit but a release is present for that tag.', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'EditAction2L0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search(TestString.editAction2KeyWord) >= 0, 'should have printed: ' + TestString.editAction2KeyWord);
       
        done();
    });

    it('Validate delete action is called when action = Delete. Validating if action is case insensitive or not.', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'DeleteAction2L0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search(TestString.deleteAction2KeyWord) >= 0, 'should have printed: ' + TestString.deleteAction2KeyWord);
        
        done();
    });

    it('Validate task fails with correct error when action = create and no tag is present.', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'CreateAction2L0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search(TestString.NoTagFoundKeyword) >= 0, 'should have printed: ' + TestString.NoTagFoundKeyword);
        
        done();
    });

    it('Validate task fails with correct error when action input is invalid', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'InvalidActionL0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search(TestString.InvalidActionKeyword) >= 0, 'should have printed: ' + TestString.InvalidActionKeyword);
        
        done();
    });

    it('Validate Utility class methods', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'UtilityL0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search(TestString.getReleaseNoteKeyword) >= 0, 'should have printed: ' + TestString.getReleaseNoteKeyword);
        assert(tr.stdout.search(TestString.validBranchNameKeyword) >= 0, 'should have printed: ' + TestString.validBranchNameKeyword);
        assert(tr.stdout.search(TestString.invalidBranchNameKeyword) >= 0, 'should have printed: ' + TestString.invalidBranchNameKeyword);
        assert(tr.stdout.search(TestString.tagMatchingKeyword) >= 0, 'should have printed: ' + TestString.tagMatchingKeyword);
        assert(tr.stdout.search(TestString.parseHTTPHeaderLinkKeyword) >= 0, 'should have printed: ' + TestString.parseHTTPHeaderLinkKeyword);
        assert(tr.stdout.search(TestString.extractRepositoryOwnerAndNameKeyword) >= 0, 'should have printed: ' + TestString.extractRepositoryOwnerAndNameKeyword);
        assert(tr.stdout.search(TestString.extractRepoAndIssueIdKeyword) >= 0, 'should have printed: ' + TestString.extractRepoAndIssueIdKeyword);
        assert(tr.stdout.search(TestString.getFirstLineKeyword) >= 0, 'should have printed: ' + TestString.getFirstLineKeyword);
        
        done();
    });

    it('Validate Helper class methods', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'HelperTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search(TestString.getTagForCreateActionKeyword) >= 0, 'should have printed: ' + TestString.getTagForCreateActionKeyword);
        assert(tr.stdout.search(TestString.getTagForCreateActionWithTagPatternKeyword) >= 0, 'should have printed: ' + TestString.getTagForCreateActionWithTagPatternKeyword);
        assert(tr.stdout.search(TestString.getCommitShaFromTargetKeyword) >= 0, 'should have printed: ' + TestString.getCommitShaFromTargetKeyword);
        assert(tr.stdout.search(TestString.getReleaseIdForTagKeyword) >= 0, 'should have printed: ' + TestString.getReleaseIdForTagKeyword);
        
        done();
    });

    it('Validate ChangeLog class methods', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'ChangeLogTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.stdout.search(TestString.getChangeLogKeyword) >= 0, 'should have printed: ' + TestString.getChangeLogKeyword);
        assert(tr.stdout.search(TestString.allIssuesChangeLog) >= 0, 'should have printed: ' + TestString.allIssuesChangeLog);
        assert(tr.stdout.search(TestString.issueBasedChangeLog) >= 0, 'should have printed: ' + TestString.issueBasedChangeLog);
        assert(tr.stdout.search(TestString.noCategoryChangeLog) >= 0, 'should have printed: ' + TestString.noCategoryChangeLog);
        assert(tr.stdout.search("Tag Name: v1.2") >=0, 'should have printed: TagName: v1.2');
        assert(tr.stdout.search("Tag Name: pre_rel") >=0, 'should have printed: TagName: pre_rel');
        assert(tr.stdout.search("Tag Name: tagName") >=0, 'should have printed: TagName: tagName');
        
        done();
    });

    it('Validate Action class methods', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'ActionTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search(TestString.createReleaseSuccessKeyword) >= 0, 'should have printed: ' + TestString.createReleaseSuccessKeyword);
        assert(tr.stdout.search(TestString.editReleaseSuccessKeyword) >= 0, 'should have printed: ' + TestString.editReleaseSuccessKeyword);
        assert(tr.stdout.search(TestString.deleteReleaseSuccessKeyword) >= 0, 'should have printed: ' + TestString.deleteReleaseSuccessKeyword);
        
        done();
    });

});
