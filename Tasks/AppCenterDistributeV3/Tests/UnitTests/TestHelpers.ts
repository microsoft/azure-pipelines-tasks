import * as assert from "assert";
var nock = require("nock");

/**
 * Exit code is used to determine whether unit test passed or not.
 * When executing code requires vsts-task-lib somewhere it makes exit code = 0 regardless whether exception was thrown.
 * This helper allows to follow default NodeJS exit code behaviour when exception is thrown.
 */
export const assertByExitCode = {
  equal: (actual, expected) => wrapAssertWithExitCode(assert.equal, actual, expected),
};

export function basicSetup() {

  nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/uploads/releases')
    .reply(201, {
        id: 1,
        package_asset_id: 1,
        upload_domain: 'https://example.upload.test/release_upload',
        url_encoded_token: "fdsf"
    });

  nock('https://example.upload.test')
    .post('/release_upload/upload/set_metadata/1')
    .query(true)
    .reply(200, {
        resume_restart: false,
        chunk_list: [1],
        chunk_size: 100,
        blob_partitions: 1
    });

  nock('https://example.upload.test')
    .post('/release_upload/upload/upload_chunk/1')
    .query(true)
    .reply(200, {

    });

  nock('https://example.upload.test')
    .post('/release_upload/upload/finished/1')
    .query(true)
    .reply(200, {
        error: false,
        state: "Done",
    });

  nock('https://example.test')
    .get('/v0.1/apps/testuser/testapp/uploads/releases/1')
    .query(true)
    .reply(200, {
        release_distinct_id: 1,
        upload_status: "readyToBePublished",
    });


  nock('https://example.test')
    .patch('/v0.1/apps/testuser/testapp/uploads/releases/1', {
        upload_status: "uploadFinished",
    })
    .query(true)
    .reply(200, {
        upload_status: "uploadFinished",
        release_url: 'https://example.upload.test/release_upload',
    });

 
}

function wrapAssertWithExitCode(assert, ...args) {
  try {
    assert.apply(undefined, args);
  } catch (error) {
    process.exit(1);
  }
}


