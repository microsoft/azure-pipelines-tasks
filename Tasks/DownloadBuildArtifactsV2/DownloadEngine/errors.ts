export class ArtifactError extends Error {
    constructor(message: string) {
        super(message);
        this.name = new.target.name;
    }
}

export class ProtocolError extends ArtifactError { }

export class IntegrityError extends ArtifactError { }

/** A worker thread stopped or failed while holding work. The blob is not at fault, so the work is repeated. */
export class WorkerFailedError extends ArtifactError { }

/** The worker threads cannot be used, so the work is done on the main thread. */
export class WorkerUnavailableError extends ArtifactError { }

/** A URL request made ahead of its use was dropped before it was sent; whoever needs the URL asks again. */
export class UrlRequestDroppedError extends ArtifactError { }

export class HttpError extends ArtifactError {
    constructor(
        message: string,
        public readonly status: number,
        public readonly requestId?: string,
        public readonly responseBody?: string,
        public readonly retryAfterMs?: number
    ) {
        super(message);
    }
}

export class AbortedError extends ArtifactError {
    constructor(message: string = 'The operation was canceled.') {
        super(message);
    }
}

export function errorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
