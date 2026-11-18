import * as fs from 'fs';
import { Logger, nullLogger } from '../util/logger';
import { ClientCertificate } from './httpClient';

/** The client certificate settings that the agent hands to a task: PEM files of the certificate and of its private key, and the password. */
export interface ClientCertificateFiles {
    certFile?: string;
    keyFile?: string;
    passphrase?: string;
}

/**
 * Reads the client certificate the agent is configured with (variables Agent.ClientCert, Agent.ClientCertKey and Agent.ClientCertPassword).
 * Returns undefined when the agent has none, or when a file is not there: the connection is then made without a certificate, and a server
 * that wants one refuses it.
 */
export function readClientCertificate(files: ClientCertificateFiles | null | undefined, logger: Logger = nullLogger): ClientCertificate | undefined {
    if (!files?.certFile || !files.keyFile) {
        return undefined;
    }
    if (!fs.existsSync(files.certFile) || !fs.existsSync(files.keyFile)) {
        logger.warning('The client certificate of the agent is configured, but its certificate file or key file was not found. The connections are made without it. In a job container, only the files of the agent that are mounted into the container can be read.');
        return undefined;
    }
    return {
        cert: fs.readFileSync(files.certFile),
        key: fs.readFileSync(files.keyFile),
        passphrase: files.passphrase ? files.passphrase : undefined
    };
}
