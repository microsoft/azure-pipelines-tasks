import * as assert from "assert";
import * as tl from "vsts-task-lib/task";
import * as dockerCommandUtils from "docker-common/dockercommandutils";
import * as pipelineutils from "docker-common/pipelineutils";

describe("DockerV2 Suite", function () {
    this.timeout(10000);

    if (!tl.osType().match(/^Win/)) {
        return;
    }

    before((done) => {
        done();
    });

    after(() => {
        delete process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'];
        delete process.env['BUILD_SOURCEVERSION'];
        delete process.env['RELEASE_RELEASEID'];
        delete process.env['BUILD_REPOSITORY_URI'];
        delete process.env['BUILD_SOURCEBRANCHNAME'];
        delete process.env['BUILD_DEFINITIONNAME'];
        delete process.env['BUILD_BUILDNUMBER'];
        delete process.env['BUILD_BUILDURI'];
        delete process.env['SYSTEM_TEAMPROJECT'];
        delete process.env['BUILD_REPOSITORY_NAME'];
        delete process.env['RELEASE_DEFINITIONNAME'];
        delete process.env['RELEASE_RELEASEWEBURL'];
    });

    it("extractSizeInBytes should return correctly", (done: MochaDone) => {
        console.log("TestCaseName: extractSizeInBytes should return correctly");

        console.log("\n");

        const bitSize = "24.01B";
        const kbSize = "8.999KB";
        const mbSize = "23mb";
        const gbSize = "1.23GB";
        const tbSize = "1tb";

        let extractedSizeInBytes = dockerCommandUtils.extractSizeInBytes(bitSize);
        assert.equal(extractedSizeInBytes, 24.01, "extractSizeInBytes should return correctly for input in bytes");

        extractedSizeInBytes = dockerCommandUtils.extractSizeInBytes(kbSize);
        assert.equal(extractedSizeInBytes, (8.999 * 1024), "extractSizeInBytes should return correctly for input in kilobytes");

        extractedSizeInBytes = dockerCommandUtils.extractSizeInBytes(mbSize);
        assert.equal(extractedSizeInBytes, (23 * 1024 * 1024), "extractSizeInBytes should return correctly for input in megabytes");

        extractedSizeInBytes = dockerCommandUtils.extractSizeInBytes(gbSize);
        assert.equal(extractedSizeInBytes, (1.23 * 1024 * 1024 * 1024), "extractSizeInBytes should return correctly for input in gigabytes");

        extractedSizeInBytes = dockerCommandUtils.extractSizeInBytes(tbSize);
        assert.equal(extractedSizeInBytes, (1 * 1024 * 1024 * 1024 * 1024), "extractSizeInBytes should return correctly for input in terabytes");

        done();
    });

    it("getImageSize should return correctly for given layers", (done: MochaDone) => {
        console.log("TestCaseName: getImageSize should return correctly for given layers");

        console.log("\n");

        let layers: { [key: string]: string }[] = [];
        layers.push({ "directive": "dir1", "args": "args1", "createdOn": "10may", "size": "24.32kb" });
        layers.push({ "directive": "dir2", "args": "args2", "createdOn": "10may", "size": "0B" });
        layers.push({ "directive": "dir3", "args": "args3", "createdOn": "10may", "size": "7b" });
        layers.push({ "directive": "dir4", "args": "args4", "createdOn": "10may", "size": "7.77GB" });
        layers.push({ "directive": "dir5", "args": "args5", "createdOn": "10may", "size": "88.9MB" });

        const expectedSize = (24.32 * 1024) + (7) + (7.77 * 1024 * 1024 * 1024) + (88.9 * 1024 * 1024);
        const expectedSizeString = expectedSize.toString() + "B";

        const actualImageSize = dockerCommandUtils.getImageSize(layers);
        assert.equal(actualImageSize.indexOf(expectedSizeString), 0, "getImageSize should return correctly for given layers");
        assert.equal(actualImageSize.length, expectedSizeString.length, "getImageSize should return correctly for given layers");
        done();
    });

    it("getDefaultLabels returns all labels when hidePII is false", (done: MochaDone) => {
        console.log("TestCaseName: getDefaultLabels returns all labels when hidePII is false");
        console.log("\n");

        setEnvironmentVariables();
        process.env['SYSTEM_HOSTTYPE'] = 'build';
        const labels = pipelineutils.getDefaultLabels();

        // update the label count in assert when newer labels are added
        assert.equal(labels.length, 9, "All labels are returned by default");

        delete process.env['SYSTEM_HOSTTYPE'];
        done();
    });

    it("getDefaultLabels returns selected labels when hidePII is true", (done: MochaDone) => {
        console.log("TestCaseName: getDefaultLabels returns selected labels when hidePII is true");
        console.log("\n");

        setEnvironmentVariables();
        process.env['SYSTEM_HOSTTYPE'] = 'build';
        const labels = pipelineutils.getDefaultLabels(true); // hidePII is set to true

        // update the label count in assert when newer labels are added
        assert.equal(labels.length, 2, "Only selected labels are returned when hidePII is true");

        delete process.env['SYSTEM_HOSTTYPE'];
        done();
    });

    function setEnvironmentVariables() : void {
        process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = 'https://mock.ms/mock/';
        process.env['BUILD_SOURCEVERSION'] = 'buildId';
        process.env['RELEASE_RELEASEID'] = 'realeaseId';
        process.env['BUILD_REPOSITORY_URI'] = 'https://mock.ms/mock/';
        process.env['BUILD_SOURCEBRANCHNAME'] = "some string";
        process.env['BUILD_DEFINITIONNAME'] = "some string";
        process.env['BUILD_BUILDNUMBER'] = "some string";
        process.env['BUILD_BUILDURI'] = 'https://mock.ms/mock/';
        process.env['SYSTEM_TEAMPROJECT'] = "some string";
        process.env['BUILD_REPOSITORY_NAME'] = "some string";
        process.env['RELEASE_DEFINITIONNAME'] = "some string";
        process.env['RELEASE_RELEASEWEBURL'] = 'https://mock.ms/mock/';
    }
});
