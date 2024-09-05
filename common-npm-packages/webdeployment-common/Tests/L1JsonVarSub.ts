import * as assert from 'assert';

import { createEnvTree, substituteJsonVariable } from '../jsonvariablesubstitutionutility';


export function runL1JsonVarSubTests(): void {

    it("Should substitute JSON variables", (done: Mocha.Done) => {
        const envVarObject = createEnvTree([
            { name: 'system.debug', value: 'true', secret: false },
            { name: 'data.ConnectionString', value: 'database_connection', secret: false },
            { name: 'data.userName', value: 'db_admin', secret: false },
            { name: 'data.password', value: 'db_pass', secret: true },
            { name: '&pl.ch@r@cter.k^y', value: '*.config', secret: false },
            { name: 'build.sourceDirectory', value: 'DefaultWorkingDirectory', secret: false },
            { name: 'user.profile.name.first', value: 'firstName', secret: false },
            { name: 'user.profile', value: 'replace_all', secret: false },
            { name: 'constructor.name', value: 'newConstructorName', secret: false },
            { name: 'constructor.valueOf', value: 'constructorNewValue', secret: false },
            { name: 'systemsettings.appurl', value: 'https://dev.azure.com/helloworld', secret: false }
        ]);

        const jsonObject = {
            'User.Profile': 'do_not_replace',
            'data': {
                'ConnectionString': 'connect_string',
                'userName': 'name',
                'password': 'pass'
            },
            '&pl': {
                'ch@r@cter.k^y': 'v@lue'
            },
            'system': {
                'debug': 'no_change'
            },
            'user.profile': {
                'name.first': 'fname'
            },
            'constructor.name': 'myconstructorname',
            'constructor': {
                'name': 'myconstructorname',
                'valueOf': 'myconstructorvalue'
            },
            'systemsettings': {
                'appurl': 'https://helloworld.visualstudio.com'
            }
        };

        substituteJsonVariable(jsonObject, envVarObject);

        assert.strictEqual(typeof jsonObject['user.profile'], 'object');
        assert.strictEqual(jsonObject['data']['ConnectionString'], 'database_connection');
        assert.strictEqual(jsonObject['data']['userName'], 'db_admin');
        assert.strictEqual(jsonObject['systemsettings']['appurl'], 'https://dev.azure.com/helloworld');
        assert.strictEqual(jsonObject['system']['debug'], 'no_change');
        assert.strictEqual(jsonObject['&pl']['ch@r@cter.k^y'], '*.config');
        assert.strictEqual(jsonObject['user.profile']['name.first'], 'firstName');
        assert.strictEqual(jsonObject['User.Profile'], 'do_not_replace');
        assert.strictEqual(jsonObject['constructor.name'], 'newConstructorName');
        assert.strictEqual(jsonObject['constructor']['name'], 'newConstructorName');
        assert.strictEqual(jsonObject['constructor']['valueOf'], 'constructorNewValue');

        done();
    });

}






