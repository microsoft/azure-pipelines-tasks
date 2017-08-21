import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import tl = require('vsts-task-lib');
import * as shared from './TestShared';

describe('ServiceFabricDockerPush Suite', function() {
    this.timeout(30000);
    before((done) => {
        done();
    });
    after(function () {
    });

    beforeEach(() => {
        process.env[shared.ContainerTypeSetting] = null;
        process.env[shared.IncludeSourceTagsSetting] = null;
        process.env[shared.AdditionalTagsSetting] = '';
        tl.getVariables().forEach(v => {
            tl.setVariable(v.name, null);
        });
    });

    if(!tl.osType().match(/^Win/)) {
        return;
    }

    it('Runs successfully using Container Registry', (done:MochaDone) => {
        let tp = path.join(__dirname, 'L0Windows.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        process.env[shared.ExpectedTags] = "latest";

        tr.run();

        console.log(tr.stdout);
        assert(tr.invokedToolCount === 4, 'should have invoked tool 4 times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        verifyStandardOutput(tr, null);

        console.log(tr.stderr);
        done();
    });

    it('Runs successfully using Azure Container Registry', (done:MochaDone) => {
        let tp = path.join(__dirname, 'L0Windows.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        process.env[shared.ContainerTypeSetting] = shared.ContainerType_AzureContainerRegistry;
        process.env[shared.ExpectedTags] = "latest";

        tr.run();

        console.log(tr.stdout);
        assert(tr.invokedToolCount === 4, 'should have invoked tool 4 times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        verifyStandardOutput(tr, "ajgtestacr1.azurecr.io");

        console.log(tr.stderr);
        done();
    });

    it('Runs successfully with source tags included', (done:MochaDone) => {
        let tp = path.join(__dirname, 'L0Windows.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        process.env[shared.IncludeSourceTagsSetting] = true;
        process.env[shared.ExpectedTags] = "latest;sourcetag1;sourcetag2";

        tl.setVariable('Build.Repository.Provider', 'TfsGit');
        tl.setVariable('Build.SourceVersion', 'sourceversion');
        tl.setVariable('Build.Repository.LocalPath', 'gitpath');

        tr.run();

        console.log(tr.stdout);
        assert(tr.invokedToolCount === 13, 'should have invoked tool 13 times (12 docker calls and 1 git call). actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        verifyStandardOutput(tr, null);

        console.log(tr.stderr);
        done();
    });

    it('Runs successfully with additional tags included', (done:MochaDone) => {
        let tp = path.join(__dirname, 'L0Windows.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        process.env[shared.AdditionalTagsSetting] = "customtag1\ncustomtag2";
        process.env[shared.ExpectedTags] = "latest;customtag1;customtag2";

        tr.run();

        console.log(tr.stdout);
        assert(tr.invokedToolCount === 12, 'should have invoked tool 12 times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        verifyStandardOutput(tr, null);

        console.log(tr.stderr);
        done();
    });
});

let verifyStandardOutput = (tr : ttm.MockTestRunner, expectedEndpoint: string) => {
    let tags = process.env[shared.ExpectedTags].split(';');

    shared.BaseImageNames.forEach(image => {
        tags.forEach(tag => {
            assert(tr.stdout.indexOf(`[command]docker tag ${image} ${shared.qualifyImageName(expectedEndpoint, image)}:${tag}`) != -1,
                `docker tag should run for tag '${tag}', image '${image}', endpoint '${expectedEndpoint}'`);
            assert(tr.stdout.indexOf(`[command]docker push ${shared.qualifyImageName(expectedEndpoint, image)}:${tag}`) != -1,
                `docker push should run for tag '${tag}', image '${image}', endpoint '${expectedEndpoint}'`);
        });

        assert(tr.stdout.indexOf(`[test]${image}Name: ${shared.qualifyImageName(expectedEndpoint, image)}:latest@sha256:${image}hash`) != -1,
            `Service manifest for image '${image}' should be updated`);
    });
};
