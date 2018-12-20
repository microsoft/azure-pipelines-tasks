import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import { CreateActionL0Tests } from './CreateActionL0Tests';
import { EditActionL0Tests } from './EditActionL0Tests';
import { EditAction2L0Tests } from './EditAction2L0Tests';
import { DeleteAction2L0Tests } from './DeleteAction2L0Tests';
import { CreateAction2L0Tests } from './CreateAction2L0Tests';
import { InvalidActionL0Tests } from './InvalidActionL0Tests';
import { UtilityL0Tests } from './UtilityL0Tests';
import { HelperL0Tests } from './HelperL0Tests';
import { ChangeLogL0Tests } from './ChangeLogL0Tests';
import { DeleteActionL0Tests } from './DeleteActionL0Tests';

describe('GitHubReleaseTaskTests Suite', function() {
    this.timeout(60000);

    it('Validate delete action is called when action = delete.', (done: MochaDone) => {
        let tp = path.join(__dirname, 'DeleteActionL0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search(DeleteActionL0Tests.deleteActionKeyWord) >= 0, 'should have printed: ' + DeleteActionL0Tests.deleteActionKeyWord);

        done();
    });

    it('Validate create action is called when action = create', (done: MochaDone) => {
        let tp = path.join(__dirname, 'CreateActionL0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search(CreateActionL0Tests.createActionKeyWord) >= 0, 'should have printed: ' + CreateActionL0Tests.createActionKeyWord);
       
        done();
    });

    it('Validate create action is called when action = edit but no release is present for that tag.', (done: MochaDone) => {
        let tp = path.join(__dirname, 'EditActionL0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search(EditActionL0Tests.createActionKeyWord) >= 0, 'should have printed: ' + EditActionL0Tests.createActionKeyWord);
        
        done();
    });

    it('Validate edit action is called when action = edit but a release is present for that tag.', (done: MochaDone) => {
        let tp = path.join(__dirname, 'EditAction2L0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search(EditAction2L0Tests.editActionKeyWord) >= 0, 'should have printed: ' + EditAction2L0Tests.editActionKeyWord);
       
        done();
    });

    it('Validate delete action is called when action = Delete. Validating if action is case insensitive or not.', (done: MochaDone) => {
        let tp = path.join(__dirname, 'DeleteAction2L0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search(DeleteAction2L0Tests.deleteActionKeyWord) >= 0, 'should have printed: ' + DeleteAction2L0Tests.deleteActionKeyWord);
        
        done();
    });

    it('Validate task fails with correct error when action = create and not tag is present.', (done: MochaDone) => {
        let tp = path.join(__dirname, 'CreateAction2L0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search(CreateAction2L0Tests.NoTagFoundKeyword) >= 0, 'should have printed: ' + CreateAction2L0Tests.NoTagFoundKeyword);
        
        done();
    });

    it('Validate task fails with correct error when action input is invalid', (done: MochaDone) => {
        let tp = path.join(__dirname, 'InvalidActionL0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search(InvalidActionL0Tests.InvalidActionKeyword) >= 0, 'should have printed: ' + InvalidActionL0Tests.InvalidActionKeyword);
        
        done();
    });

    it('Validate Utility class methods', (done: MochaDone) => {
        let tp = path.join(__dirname, 'UtilityL0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search(UtilityL0Tests.getReleaseNoteKeyword) >= 0, 'should have printed: ' + UtilityL0Tests.getReleaseNoteKeyword);
        assert(tr.stdout.search(UtilityL0Tests.validBranchNameKeyword) >= 0, 'should have printed: ' + UtilityL0Tests.validBranchNameKeyword);
        assert(tr.stdout.search(UtilityL0Tests.invalidBranchNameKeyword) >= 0, 'should have printed: ' + UtilityL0Tests.invalidBranchNameKeyword);
        assert(tr.stdout.search(UtilityL0Tests.parseHTTPHeaderLinkKeyword) >= 0, 'should have printed: ' + UtilityL0Tests.parseHTTPHeaderLinkKeyword);
        assert(tr.stdout.search(UtilityL0Tests.extractRepositoryOwnerAndNameKeyword) >= 0, 'should have printed: ' + UtilityL0Tests.extractRepositoryOwnerAndNameKeyword);
        assert(tr.stdout.search(UtilityL0Tests.extractRepoAndIssueIdKeyword) >= 0, 'should have printed: ' + UtilityL0Tests.extractRepoAndIssueIdKeyword);
        assert(tr.stdout.search(UtilityL0Tests.getFirstLineKeyword) >= 0, 'should have printed: ' + UtilityL0Tests.getFirstLineKeyword);
        
        done();
    });

    it('Validate Helper class methods', (done: MochaDone) => {
        let tp = path.join(__dirname, 'HelperTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search(HelperL0Tests.getTagForCreateActionKeyword) >= 0, 'should have printed: ' + HelperL0Tests.getTagForCreateActionKeyword);
        assert(tr.stdout.search(HelperL0Tests.getCommitShaFromTargetKeyword) >= 0, 'should have printed: ' + HelperL0Tests.getCommitShaFromTargetKeyword);
        assert(tr.stdout.search(HelperL0Tests.getReleaseIdForTagKeyword) >= 0, 'should have printed: ' + HelperL0Tests.getReleaseIdForTagKeyword);
        
        done();
    });

    it('Validate ChangeLog class methods', (done: MochaDone) => {
        let tp = path.join(__dirname, 'ChangeLogTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search(ChangeLogL0Tests.getChangeLogKeyword) >= 0, 'should have printed: ' + ChangeLogL0Tests.getChangeLogKeyword);
        
        done();
    });

});
