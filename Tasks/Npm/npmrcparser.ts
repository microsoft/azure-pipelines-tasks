import * as fs from 'fs';
import * as ini from 'ini';
import * as url from 'url';

import * as tl from 'vsts-task-lib/task';

export function GetRegistries(npmrc: string): string[] {
    let registries: string[] = [];
    let config = ini.parse(fs.readFileSync(npmrc).toString());

    for (let key in config) {
        let colonIndex = key.indexOf(':');
        if (key.substring(colonIndex + 1).toLowerCase() === 'registry') {
            config[key] = NormalizeRegistry(config[key]);
            registries.push(config[key]);
        }
    }

    // save the .npmrc with normalized registries
    tl.writeFile(npmrc, ini.stringify(config));
    return registries;
}

export function NormalizeRegistry(registry: string): string {
    if (registry) {
        registry = registry.slice(-1) !== '/' ? registry + '/' : registry;
    }

    return registry;
}
