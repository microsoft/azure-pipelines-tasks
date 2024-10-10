import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';

import { createEnvTree, stripJsonComments, substituteJsonVariable } from "../jsonvariablesubstitutionutility";


export function runL1JSONVarSubWithCommentsTests(): void {

    it("Should substitute variables in JSON with comments", (done: Mocha.Done) => {
        const envVarObject = createEnvTree([
            { name: 'dataSourceBindings.0.target', value: 'AppServiceName', secret: false },
            { name: 'name', value: 'App Service Deploy', secret: false },
            { name: 'Hello.World', value: 'Hello World', secret: false },
            { name: 'dataSourceBindings.1.parameters.WebAppName', value: 'App Service Name params', secret: false },
            { name: 'messages.Invalidwebapppackageorfolderpathprovided', value: 'Invalidwebapppackageorfolderpathprovided', secret: true }
        ]);

        const fileContent: string = fs.readFileSync(path.join(__dirname, 'L1JSONVarSub', 'JSONWithComments.json'), 'utf-8');
        const jsonContent: string = stripJsonComments(fileContent);
        const jsonObject = JSON.parse(jsonContent);
        substituteJsonVariable(jsonObject, envVarObject);

        assert.strictEqual(jsonObject['dataSourceBindings']['0']['target'], 'AppServiceName', 'Should have substituted target variable');
        assert.strictEqual(jsonObject['name'], 'App Service Deploy', 'Should have substituted name variable');
        assert.strictEqual(jsonObject['Hello']['World'], 'Hello World', 'Should have substituted Hello.World variable');
        assert.strictEqual(jsonObject['dataSourceBindings']['1']['parameters']['WebAppName'], 'App Service Name params', 'Should have substituted WebAppName variable');
        assert.strictEqual(jsonObject['messages']['Invalidwebapppackageorfolderpathprovided'], 'Invalidwebapppackageorfolderpathprovided', 'Should have substituted Invalidwebapppackageorfolderpathprovided variable');

        done();
    });

    it("Should throw exception for invalid JSON with comments", (done: Mocha.Done) => {
        const fileContent = fs.readFileSync(path.join(__dirname, 'L1JSONVarSub', 'InvalidJSONWithComments.json'), 'utf-8');
        const jsonContent = stripJsonComments(fileContent);
        assert.throws(() => JSON.parse(jsonContent), "Parse is expected to throw an error");
        done();
    });
}