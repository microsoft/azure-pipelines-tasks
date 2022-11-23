import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as toml from 'toml';
import * as fs from 'fs';
import * as constants from './constants';

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, 'task.json'));

    try {
        let configtoml = tl.getInput(constants.CargoAuthenticateTaskInput.WorkingFile);
        if (!(configtoml.endsWith('.toml'))) {
            throw new Error(tl.loc('ConfigTomlNotToml', configtoml));
        }
        else if (!tl.exist(configtoml)) {
            throw new Error(tl.loc('ConfigTomlDoesNotExist', configtoml));
        }
        else {
            console.log(tl.loc("AuthenticatingThisConfigToml", configtoml));
        }
        
        // These two format will work
        // [registries]
        // zhentan-test = { index = "sparse+https://pkgs.dev.azure.com/codesharing-SU0/zhentan-test/_packaging/zhentan-test/Cargo/index/" }
        // [registries.zhentan-test1]
        // index = "sparse+https://pkgs.dev.azure.com/codesharing-SU0/zhentan-test/_packaging/zhentan-test/Cargo/index/"
        let configtomlFile = fs.readFileSync(configtoml, 'utf8');
        var result = toml.parse(configtomlFile);
        if (!result.registries)
        {
            throw new Error("config.toml must contains registries field");
        }
        var registries = Object.keys(result.registries);
        var token = `Bearer ${tl.getVariable('System.AccessToken')}`;

        for(let registry of registries) {
            var tokenName = `CARGO_REGISTRIES_${registry.toLocaleUpperCase().replace("-", "_")}_TOKEN`;
            tl.debug(tl.loc('AddingAuthRegistry', registry, tokenName));
            tl.setVariable(tokenName, token);
        }

        //External endpoints
    }

    catch(error) {
        tl.error(error);
        tl.setResult(tl.TaskResult.Failed, tl.loc("FailedToAddAuthentication"));
        return;
    }

    finally {
        // What telemetry we can emit?
    }
    
}

main();