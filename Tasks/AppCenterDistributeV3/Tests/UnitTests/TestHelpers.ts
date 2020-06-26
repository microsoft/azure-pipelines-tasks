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

  const uploadDomain = 'https://example.upload.test/release_upload';
  const assetId = "00000000-0000-0000-0000-000000000123";
  const uploadId = 7;

  nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/uploads/releases')
    .reply(201, {
        id: uploadId,
        package_asset_id: assetId,
        upload_domain: uploadDomain,
        url_encoded_token: "token"
    });

  nock(uploadDomain)
    .post(`/upload/set_metadata/${assetId}`)
    .query(true)
    .reply(200, {
        resume_restart: false,
        chunk_list: [1],
        chunk_size: 100,
        blob_partitions: 1
    });

  nock(uploadDomain)
    .post(`/upload/upload_chunk/${assetId}`)
    .query(true)
    .reply(200, {

    });

  nock(uploadDomain)
    .post(`/upload/finished/${assetId}`)
    .query(true)
    .reply(200, {
        error: false,
        state: "Done",
    });

  nock('https://example.test')
    .get(`/v0.1/apps/testuser/testapp/uploads/releases/${uploadId}`)
    .query(true)
    .reply(200, {
        release_distinct_id: 1,
        upload_status: "readyToBePublished",
    });

  nock('https://example.test')
    .patch(`/v0.1/apps/testuser/testapp/uploads/releases/${uploadId}`, {
        upload_status: "uploadFinished",
    })
    .query(true)
    .reply(200, {
        upload_status: "uploadFinished"
    });

    nock('https://example.test')
        .put('/v0.1/apps/testuser/testapp/releases/1', JSON.stringify({
            release_notes: 'my release notes'
        }))
        .reply(200);

    //make it available
    nock('https://example.test')
      .post('/v0.1/apps/testuser/testapp/releases/1/groups', {
        id: "00000000-0000-0000-0000-000000000000"
      })
      .reply(200);
            
    //finishing symbol upload, commit the symbol 
    nock('https://example.test')
      .patch('/v0.1/apps/testuser/testapp/symbol_uploads/100', {
        status: 'committed'
      })
    .reply(200);
}

function wrapAssertWithExitCode(assert, ...args) {
  try {
    assert.apply(undefined, args);
  } catch (error) {
    process.exit(1);
  }
}


