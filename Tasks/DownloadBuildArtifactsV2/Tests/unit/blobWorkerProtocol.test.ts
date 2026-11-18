import * as assert from 'assert';
import { AbortedError, ArtifactError, HttpError, IntegrityError, ProtocolError } from '../../DownloadEngine/errors';
import { deserializeError, serializeError } from '../../DownloadEngine/dedup/blobWorkerProtocol';
import { RequestTimeoutError, isTransientError } from '../../DownloadEngine/http/httpClient';

/** What an error becomes on its way from a worker thread: only plain data arrives, and the receiver rebuilds the error. */
function crossed(error: unknown): Error {
    return deserializeError(JSON.parse(JSON.stringify(serializeError(error))));
}

describe('errors that cross from a worker thread', () => {
    it('keep the status, the request and the wait of an HTTP error', () => {
        const error = crossed(new HttpError('GET failed with HTTP 503', 503, 'request-1', 'busy', 5000));
        assert.ok(error instanceof HttpError);
        assert.strictEqual(error.status, 503);
        assert.strictEqual(error.requestId, 'request-1');
        assert.strictEqual(error.retryAfterMs, 5000);
        assert.strictEqual(error.message, 'GET failed with HTTP 503');
    });

    it('keep the class that the callers look at', () => {
        assert.ok(crossed(new IntegrityError('damaged')) instanceof IntegrityError);
        assert.ok(crossed(new ProtocolError('unexpected')) instanceof ProtocolError);
        assert.ok(crossed(new ArtifactError('other')) instanceof ArtifactError);
        assert.ok(crossed(new AbortedError()) instanceof AbortedError);
        const timeout = crossed(new RequestTimeoutError('too slow'));
        assert.ok(timeout instanceof RequestTimeoutError);
        assert.strictEqual((timeout as RequestTimeoutError).code, 'ETIMEDOUT');
    });

    it('keep the properties of a system error', () => {
        const failure: NodeJS.ErrnoException = Object.assign(new Error('no space left'), { code: 'ENOSPC', errno: -28, syscall: 'write', path: '/tmp/file' });
        const error = crossed(failure) as NodeJS.ErrnoException;
        assert.strictEqual(error.code, 'ENOSPC');
        assert.strictEqual(error.errno, -28);
        assert.strictEqual(error.syscall, 'write');
        assert.strictEqual(error.path, '/tmp/file');
    });

    it('stay worth repeating when they were, and stay final when they were', () => {
        assert.strictEqual(isTransientError(crossed(new HttpError('busy', 503))), true);
        assert.strictEqual(isTransientError(crossed(new HttpError('throttled', 429))), true);
        assert.strictEqual(isTransientError(crossed(new HttpError('gone', 404))), false);
        assert.strictEqual(isTransientError(crossed(Object.assign(new Error('reset'), { code: 'ECONNRESET' }))), true);
        assert.strictEqual(isTransientError(crossed(new RequestTimeoutError('too slow'))), true);
        assert.strictEqual(isTransientError(crossed(new AbortedError())), false);
    });
});
