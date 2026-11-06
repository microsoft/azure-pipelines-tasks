import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { cleanupGlobalConfig, saveAndActivateGlobalConfig } from '../npmGlobalConfig';
import { TestEnvVars } from './TestConstants';

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));
const root = process.env[TestEnvVars.globalTestRoot];
const originalPath = path.join(root, 'original.npmrc');
const scenario = process.env[TestEnvVars.globalScenario];
const first = { url: 'https://registry.example/feed/', auth: '//registry.example/feed/:_authToken=first' };

try {
    if (scenario === 'relative') {
        fs.writeFileSync(originalPath, 'cafile=relative.pem\n');
        assert.throws(() => saveAndActivateGlobalConfig([first]), /relative path/i);
        assert.strictEqual(tl.getVariable('NPM_AUTHENTICATE_GLOBAL_CONFIG'), undefined);
    } else if (scenario === 'resolution') {
        assert.throws(() => saveAndActivateGlobalConfig([first]), /resolve.*global config/i);
    } else if (scenario === 'sections') {
        fs.writeFileSync(originalPath, '[section]\nkey=value\n');
        assert.throws(() => saveAndActivateGlobalConfig([first]), /merge authentication/i);
        cleanupGlobalConfig({ onlyUnactivated: true });
        assert.deepStrictEqual(fs.readdirSync(root), ['original.npmrc']);
    } else if (scenario === 'permissions') {
        assert.throws(() => saveAndActivateGlobalConfig([first]), /restrict access/i);
        assert.deepStrictEqual(fs.readdirSync(root), []);
    } else {
        const original = '# preserved\nproxy=https://proxy.example/\n//other.example/:_authToken=other\n';
        if (scenario !== 'missing') {
            fs.writeFileSync(originalPath, original);
        }
        saveAndActivateGlobalConfig([first]);
        const file = tl.getVariable('NPM_AUTHENTICATE_GLOBAL_CONFIG');
        cleanupGlobalConfig({ onlyUnactivated: true });
        assert(fs.existsSync(file), 'Failure cleanup must preserve a published file');
        assert.strictEqual(process.env.NPM_CONFIG_GLOBALCONFIG, file);
        assert(fs.readFileSync(file, 'utf8').includes(first.auth));
        if (scenario !== 'missing') {
            assert.strictEqual(fs.readFileSync(originalPath, 'utf8'), original);
            const generatedContents = fs.readFileSync(file, 'utf8');
            assert(generatedContents.includes(original.split('\n').slice(1).join('\n').trim()));
            assert(!generatedContents.includes('# preserved'));
        }
        if (scenario === 'selection') {
            tl.setVariable('NPM_CONFIG_GLOBALCONFIG', originalPath);
            assert.throws(() => saveAndActivateGlobalConfig([first]), /selection changed/i);
            cleanupGlobalConfig();
            assert.strictEqual(process.env.NPM_CONFIG_GLOBALCONFIG, originalPath);
        } else if (scenario === 'replacement') {
            const held = path.join(root, 'held.npmrc');
            fs.renameSync(file, held);
            fs.writeFileSync(file, 'replacement');
            assert.throws(() => cleanupGlobalConfig(), /config file was replaced/i);
            assert.strictEqual(fs.readFileSync(file, 'utf8'), 'replacement');
            fs.unlinkSync(file);
            fs.renameSync(held, file);
            cleanupGlobalConfig();
        } else {
            saveAndActivateGlobalConfig([
                { url: 'https://second.example/', auth: '//second.example/:_authToken=second' },
                { url: first.url, auth: '//registry.example/feed/:_authToken=latest' }
            ]);
            assert.strictEqual(tl.getVariable('NPM_AUTHENTICATE_GLOBAL_CONFIG'), file);
            const content = fs.readFileSync(file, 'utf8');
            assert(content.includes('_authToken=second'));
            assert(content.includes('_authToken=latest'));
            assert(!content.includes('_authToken=first'));
            const beforeFailure = content;
            assert.throws(() => saveAndActivateGlobalConfig([
                { url: 'not a URL', auth: 'invalid' }
            ]), /merge authentication/i);
            cleanupGlobalConfig({ onlyUnactivated: true });
            assert.strictEqual(fs.readFileSync(file, 'utf8'), beforeFailure);
            cleanupGlobalConfig();
            cleanupGlobalConfig();
        }
        assert(!fs.existsSync(file));
        assert(!fs.existsSync(path.dirname(file)));
    }
    tl.setResult(tl.TaskResult.Succeeded, 'Global configuration scenario passed');
} catch (error) {
    tl.setResult(tl.TaskResult.Failed, error instanceof Error ? error.message : String(error));
}
