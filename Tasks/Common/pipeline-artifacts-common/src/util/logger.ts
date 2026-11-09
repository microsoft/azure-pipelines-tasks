export interface Logger {
    debug(message: string): void;
    info(message: string): void;
    warning(message: string): void;
    error(message: string): void;
}

export const nullLogger: Logger = {
    debug: () => undefined,
    info: () => undefined,
    warning: () => undefined,
    error: () => undefined
};

export const consoleLogger: Logger = {
    debug: message => console.log(`[debug] ${message}`),
    info: message => console.log(message),
    warning: message => console.warn(`[warning] ${message}`),
    error: message => console.error(`[error] ${message}`)
};
