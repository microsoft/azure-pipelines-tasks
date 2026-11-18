import * as crypto from 'crypto';

/** Certificates for tests of mutual TLS, made on the fly (an authority, a server and a client) so that no key has to be kept in the repository. */

function der(tag: number, ...parts: Buffer[]): Buffer {
    const content = Buffer.concat(parts);
    const length = content.length < 128
        ? Buffer.from([content.length])
        : content.length < 256 ? Buffer.from([0x81, content.length]) : Buffer.from([0x82, content.length >> 8, content.length & 0xff]);
    return Buffer.concat([Buffer.from([tag]), length, content]);
}

const sequence = (...parts: Buffer[]) => der(0x30, ...parts);
const set = (...parts: Buffer[]) => der(0x31, ...parts);
const octetString = (value: Buffer) => der(0x04, value);
const bitString = (value: Buffer, unusedBits = 0) => der(0x03, Buffer.from([unusedBits]), value);
const utf8String = (value: string) => der(0x0c, Buffer.from(value, 'utf8'));
const booleanTrue = () => der(0x01, Buffer.from([0xff]));

function integer(value: Buffer): Buffer {
    return der(0x02, value[0] & 0x80 ? Buffer.concat([Buffer.from([0]), value]) : value);
}

function objectIdentifier(dotted: string): Buffer {
    const parts = dotted.split('.').map(Number);
    const bytes: number[] = [parts[0] * 40 + parts[1]];
    for (const part of parts.slice(2)) {
        const encoded = [part & 0x7f];
        for (let rest = part >> 7; rest > 0; rest >>= 7) {
            encoded.unshift((rest & 0x7f) | 0x80);
        }
        bytes.push(...encoded);
    }
    return der(0x06, Buffer.from(bytes));
}

function utcTime(date: Date): Buffer {
    const pad = (value: number) => String(value).padStart(2, '0');
    const text = `${pad(date.getUTCFullYear() % 100)}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
    return der(0x17, Buffer.from(text, 'ascii'));
}

const nameOf = (commonName: string) => sequence(set(sequence(objectIdentifier('2.5.4.3'), utf8String(commonName))));
const extension = (oid: string, value: Buffer, critical = false) =>
    sequence(objectIdentifier(oid), ...(critical ? [booleanTrue()] : []), octetString(value));
const ecdsaWithSha256 = () => sequence(objectIdentifier('1.2.840.10045.4.3.2'));

function pem(label: string, content: Buffer): string {
    const lines = content.toString('base64').match(/.{1,64}/g) ?? [];
    return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}

export interface Identity {
    certificate: string;
    privateKey: string;
    /** The private key, encrypted with the password 'secret'. */
    encryptedPrivateKey: string;
    commonName: string;
    key: crypto.KeyObject;
}

type Kind = 'authority' | 'server' | 'client';

/** The addresses (as bytes) and names that a server certificate is valid for. */
interface ServerNames {
    addresses: number[][];
    hosts: string[];
}

function issue(commonName: string, kind: Kind, issuer?: Identity, names: ServerNames = { addresses: [[127, 0, 0, 1]], hosts: ['localhost'] }): Identity {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const signer = issuer?.key ?? privateKey;
    const now = Date.now();

    const extensions: Buffer[] = [];
    if (kind === 'authority') {
        extensions.push(extension('2.5.29.19', sequence(booleanTrue()), true));
        extensions.push(extension('2.5.29.15', bitString(Buffer.from([0x06]), 1), true));
    } else {
        extensions.push(extension('2.5.29.15', bitString(Buffer.from([0x80]), 7), true));
        extensions.push(extension('2.5.29.37', sequence(objectIdentifier(kind === 'server' ? '1.3.6.1.5.5.7.3.1' : '1.3.6.1.5.5.7.3.2'))));
    }
    if (kind === 'server') {
        extensions.push(extension('2.5.29.17', sequence(
            ...names.addresses.map(address => der(0x87, Buffer.from(address))),
            ...names.hosts.map(host => der(0x82, Buffer.from(host, 'ascii'))))));
    }

    const serial = crypto.randomBytes(8);
    serial[0] = (serial[0] & 0x7f) | 0x40;
    const toBeSigned = sequence(
        der(0xa0, integer(Buffer.from([2]))),
        integer(serial),
        ecdsaWithSha256(),
        nameOf(issuer?.commonName ?? commonName),
        sequence(utcTime(new Date(now - 24 * 3600 * 1000)), utcTime(new Date(now + 2 * 24 * 3600 * 1000))),
        nameOf(commonName),
        Buffer.from(publicKey.export({ type: 'spki', format: 'der' })),
        der(0xa3, sequence(...extensions))
    );
    const signature = crypto.sign('sha256', toBeSigned, signer);
    const certificate = sequence(toBeSigned, ecdsaWithSha256(), bitString(signature));

    return {
        certificate: pem('CERTIFICATE', certificate),
        privateKey: String(privateKey.export({ type: 'pkcs8', format: 'pem' })),
        encryptedPrivateKey: String(privateKey.export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: 'secret' })),
        commonName,
        key: privateKey
    };
}

export function createTestCertificates(): {
    authority: Identity; server: Identity; client: Identity; otherAuthority: Identity; otherClient: Identity;
    /** A server that is valid for the address 127.0.0.1 only, and one that is valid for the name localhost only. */
    addressServer: Identity; nameServer: Identity;
} {
    const authority = issue('test authority', 'authority');
    const otherAuthority = issue('other authority', 'authority');
    return {
        authority,
        server: issue('localhost', 'server', authority),
        client: issue('test client', 'client', authority),
        otherAuthority,
        otherClient: issue('other client', 'client', otherAuthority),
        addressServer: issue('127.0.0.1', 'server', authority, { addresses: [[127, 0, 0, 1]], hosts: [] }),
        nameServer: issue('localhost', 'server', authority, { addresses: [], hosts: ['localhost'] })
    };
}
