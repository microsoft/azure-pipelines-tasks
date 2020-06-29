
import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import azureBlobUploadHelper = require('../azure-blob-upload-helper');

const Readable = require('stream').Readable
const Writable = require('stream').Writable
const Stats = require('fs').Stats

const nock = require('nock');

const taskPath = path.join(__dirname, '..', 'appcenterdistribute.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('serverEndpoint', 'MyTestEndpoint');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', '/test/path/to/my.ipa');
tmr.setInput('releaseNotesSelection', 'releaseNotesInput');
tmr.setInput('releaseNotesInput', 'my release notes');
tmr.setInput('symbolsType', 'UWP');
tmr.setInput('pdbPath', 'a/**/*.pdb');

/*
  dSyms folder structure:
  a
    f.txt
    b
      f.txt
      c
        d
          f.txt
        y.pdb
        x.pdb
        z.pdb
*/

nock('https://example.test')
    .patch('/v0.1/apps/testuser/testapp/releases/1')
    .query(true)
    .reply(200);

nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/uploads/releases')
    .query(true)
    .reply(201, {
        id: 1,
        upload_url: "https://upload.example.test/upload/upload_chunk/1",
        package_asset_id: 1,
        upload_domain: 'https://example.upload.test/release_upload',
        url_encoded_token: "fdsf"
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
        upload_status: "committed",
    })
    .query(true)
    .reply(200, {
        upload_status: "committed",
        release_url: 'https://example.upload.test/release_upload',
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

nock('https://example.upload.test')
    .post('/release_upload/upload/set_metadata/1')
    .query(true)
    .reply(200, {
        resume_restart: false,
        chunk_list: [1],
        chunk_size: 100,
        blob_partitions: 1
    });

//finishing upload, commit the package
nock('https://example.test')
    .patch('/v0.1/apps/testuser/testapp/release_uploads/1', {
        status: 'committed'
    })
    .reply(200, {
        release_url: 'my_release_location' 
    });

//make it available
nock('https://example.test')
    .patch('/my_release_location', {
        status: 'available',
        destinations: [{ id: "00000000-0000-0000-0000-000000000000" }],
        release_notes: 'my release notes'
    })
    .reply(200);

//begin symbol upload
nock('https://example.test')
    .post('/v0.1/apps/testuser/testapp/symbol_uploads', {
        symbol_type: 'UWP'
    })
    .reply(201, {
        symbol_upload_id: 100,
        upload_url: 'https://example.upload.test/symbol_upload',
        expiration_date: 1234567
    });

//finishing symbol upload, commit the symbol 
nock('https://example.test')
    .patch('/v0.1/apps/testuser/testapp/symbol_uploads/100', {
        status: 'committed'
    })
    .reply(200);

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'checkPath' : {
        '/test/path/to/my.ipa': true,
        'a': true,
        'a/f.txt': true,
        'a/b': true,
        'a/b/f.txt': true,
        'a/b/c': true,
        'a/b/c/f.txt': true,
        'a/b/c/d': true,
        'a/b/c/d/f.txt': true,
        'a/b/c/x.pdb': true,
        'a/b/c/y.pdb': true,
        'a/b/c/z.pdb': true
    },
    'findMatch' : {
        'a/**/*.pdb': [
            'a/b/c/x.pdb',
            'a/b/c/y.pdb',
            'a/b/c/z.pdb'
        ],
        '/test/path/to/my.ipa': [
            '/test/path/to/my.ipa'
        ]
    }
};
tmr.setAnswers(a);

fs.createReadStream = (s: string) => {
    let stream = new Readable;
    stream.push(s);
    stream.push(null);

    return stream;
};

fs.createWriteStream = (s: string) => {
    let stream = new Writable;

    stream.write = () => {};

    return stream;
};

fs.readdirSync = (folder: string) => {
    let files: string[] = [];

    if (folder === 'a') {
        files = [
            'f.txt',
            'b'
        ]
    } else if (folder === 'a/b') {
        files = [
            'f.txt',
            'c',
            'd'
        ]
    } else if (folder === 'a/b/c') {
        files = [
            'd',
            'x.pdb',
            'y.pdb',
            'z.pdb'
        ]
    } else if (folder === 'a/b/c/d') {
        files = [
            'f.txt'
        ]
    }

    return files;
};

fs.statSync = (s: string) => {
    let stat = new Stats;

    stat.isFile = () => {
        if (s.endsWith('.txt') || s.endsWith('.pdb')) {
            return true;
        } else {
            return false;
        }
    }

    stat.isDirectory = () => {
        if (s.endsWith('.txt') || s.endsWith('.pdb')) {
            return false;
        } else {
            return true;
        }
    }

    stat.size = 100;

    return stat;
}

azureBlobUploadHelper.AzureBlobUploadHelper.prototype.upload = async () => {
    return Promise.resolve();
}

let fsos = fs.openSync;
fs.openSync = (path: string, flags: string) => {
    if (path.endsWith("my.ipa")){
        return 1234567.89;
    }
    return fsos(path, flags);
};

let fsrs = fs.readSync;
fs.readSync = (fd: number, buffer: Buffer, offset: number, length: number, position: number)=> {
    if (fd==1234567.89) {
        buffer = new Buffer(100);
        return;
    }
    return fsrs(fd, buffer, offset, length, position);
};

tmr.registerMock('azure-blob-upload-helper', azureBlobUploadHelper);
tmr.registerMock('fs', fs);

tmr.run();

