import * as fs from 'fs';
import * as ini from 'ini';

import * as tl from 'azure-pipelines-task-lib/task';

export function GetRegistries(npmrc: string, saveNormalizedRegistries: boolean): string[] {
    let registries: string[] = [];
    let config = ini.parse(fs.readFileSync(npmrc).toString());

    for (let key in config) {
        let colonIndex = key.indexOf(':');
        if (key.substring(colonIndex + 1).toLowerCase() === 'registry') {
            config[key] = NormalizeRegistry(config[key]);
            registries.push(config[key]);
        }
    }

    if (saveNormalizedRegistries) {
        // save the .npmrc with normalized registries
        tl.writeFile(npmrc, ini.stringify(config));
    }
    return registries;
}

export function NormalizeRegistry(registry: string): string {
    if ( registry && !registry.endsWith('/') ) {
        registry += '/';
    }
    return registry;
}
