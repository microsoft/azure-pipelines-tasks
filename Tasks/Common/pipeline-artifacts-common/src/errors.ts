export class ArtifactError extends Error {
    constructor(message: string) {
        super(message);
        this.name = new.target.name;
    }
}

export class ProtocolError extends ArtifactError { }

export class IntegrityError extends ArtifactError { }

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
