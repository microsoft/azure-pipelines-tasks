import * as assert from 'assert';
import * as utils from '../src/utils/utilities';

describe('Helm set argument handling', function () {
    const flag = 'DISTRIBUTEDTASK_TASKS_KUBERNETESMANIFEST_DISABLESTRICTSETARGUMENTS';

    afterEach(() => {
        delete process.env[flag];
    });

    it('escapes separators by default', () => {
        assert.strictEqual(utils.escapeHelmSetToken('x,image.repository=other'), 'x\\,image.repository=other');
        assert.strictEqual(utils.escapeHelmSetToken('a\\'), 'a\\\\');
    });

    it('leaves ordinary values unchanged', () => {
        assert.strictEqual(utils.escapeHelmSetToken('image.tag'), 'image.tag');
        assert.strictEqual(utils.escapeHelmSetToken('1.2.3'), '1.2.3');
        assert.strictEqual(utils.escapeHelmSetToken(''), '');
    });

    it('preserves existing backslash escapes in key paths', () => {
        const name = 'ingress.annotations.kubernetes\\.io/ingress\\.class';
        assert.strictEqual(utils.escapeHelmSetToken(name), name);
    });

    it('keeps Helm list syntax active in values and still escapes stray commas', () => {
        assert.strictEqual(utils.escapeHelmSetToken('{alpha,beta}', true), '{alpha,beta}');
        assert.strictEqual(utils.escapeHelmSetToken('{alpha,beta},x', true), '{alpha\\,beta}\\,x');
        assert.strictEqual(utils.escapeHelmSetToken('foo{a,b=1}', true), 'foo{a\\,b=1}');
        assert.strictEqual(utils.escapeHelmSetToken('{a}x{b,c}', true), '{a}x{b\\,c}');
        assert.strictEqual(utils.escapeHelmSetToken('{a,{b,c}}', true), '{a\\,{b\\,c}}');
        assert.strictEqual(utils.escapeHelmSetToken('{alpha,beta', true), '{alpha\\,beta');
    });

    it('keeps legacy behavior when the kill-switch is enabled', () => {
        process.env[flag] = 'true';
        assert.strictEqual(utils.escapeHelmSetToken('x,image.repository=other'), 'x,image.repository=other');
    });
});