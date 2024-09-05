import assert = require('assert');
import { createEnvTree, substituteJsonVariableV2 } from '../jsonvariablesubstitutionutility';

export function runL1JsonVarSubV2Tests(): void {
    it("Should substitute JSON variables V2", (done: Mocha.Done) => {
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
            { name: 'profile.users', value: '["suaggar","rok","asranja", "chaitanya"]', secret: false },
            { name: 'profile.enabled', value: 'false', secret: false },
            { name: 'profile.version', value: '1173', secret: false },
            { name: 'profile.somefloat', value: '97.75', secret: false },
            { name: 'profile.preimum_level', value: '{"suaggar": "V4", "rok": "V5", "asranja": { "type" : "V6"}}', secret: false },
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
            'profile': {
                'users': ['arjgupta', 'raagra', 'muthuk'],
                'preimum_level': {
                    'arjgupta': 'V1',
                    'raagra': 'V2',
                    'muthuk': {
                        'type': 'V3'
                    }
                },
                "enabled": true,
                "version": 2,
                "somefloat": 2.3456
            },
            'systemsettings': {
                'appurl': 'https://helloworld.visualstudio.com'
            }

        };

        substituteJsonVariableV2(jsonObject, envVarObject);

        assert.strictEqual(jsonObject['data']['ConnectionString'], 'database_connection');
        assert.strictEqual(jsonObject['data']['userName'], 'db_admin');
        assert.strictEqual(jsonObject['systemsettings']['appurl'], 'https://dev.azure.com/helloworld');
        assert.strictEqual(jsonObject['system']['debug'], 'no_change');
        assert.strictEqual(jsonObject['&pl']['ch@r@cter.k^y'], '*.config');
        assert.strictEqual(jsonObject['User.Profile'], 'do_not_replace');
        assert.strictEqual(jsonObject['constructor.name'], 'newConstructorName');
        assert.strictEqual(jsonObject['constructor']['name'], 'newConstructorName');
        assert.strictEqual(jsonObject['constructor']['valueOf'], 'constructorNewValue');
        assert.strictEqual(jsonObject['profile']['users'].length, 4);
        assert.notStrictEqual(jsonObject['profile']['users'].indexOf('suaggar'), -1);
        assert.notStrictEqual(jsonObject['profile']['users'].indexOf('rok'), -1);
        assert.notStrictEqual(jsonObject['profile']['users'].indexOf('asranja'), -1);
        assert.notStrictEqual(jsonObject['profile']['users'].indexOf('chaitanya'), -1);
        assert.strictEqual(jsonObject['profile']['enabled'], false);
        assert.strictEqual(jsonObject['profile']['somefloat'], 97.75);
        assert.strictEqual(jsonObject['profile']['version'], 1173);
        assert.deepStrictEqual(jsonObject['profile']['preimum_level'], { suaggar: "V4", rok: "V5", asranja: { type: "V6" } });

        done();
    });
}
