"use strict";
import * as fs from "fs";

export function getFinalComposeFileName(): string {
    return ".docker-compose." + Date.now() + ".yml"
}

export function writeFileSync(filename: string, data: any, options?: { encoding?: string; mode?: number; flag?: string; }): void {
    fs.writeFileSync(filename, data, options);
}