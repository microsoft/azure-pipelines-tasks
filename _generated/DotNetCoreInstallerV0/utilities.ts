import { chmodSync } from 'fs';

export function getCurrentDir(): string {
    return __dirname;
}

export function setFileAttribute(file: string, mode: string): void {
    chmodSync(file, mode);
}