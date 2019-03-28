import { chmodSync } from 'fs';

export function getDirname(): string {
    return __dirname;
}

export function setFileAttribute(file: string, mode: string): void {
    chmodSync(file, mode);
}