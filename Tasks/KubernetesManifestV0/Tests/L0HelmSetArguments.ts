import * as assert from 'assert';
import * as utils from '../src/utils/utilities';

describe('Helm set argument handling', function () {
    const flag = 'DISTRIBUTEDTASK_TASKS_KUBERNETESMANIFEST_DISABLESTRICTSETARGUMENTS';

    afterEach(() => {
        delete process.env[flag];
    });

    it('escapes separators by default', () => {
        assert.strictEqual(utils.escapeHelmSetToken('x,image.repository=other'), 'x\\,image.repository=other');
        assert.strictEqual(utils.escapeHelmSetToken('a\\b'), 'a\\\\b');
    });

    it('leaves ordinary values unchanged', () => {
        assert.strictEqual(utils.escapeHelmSetToken('image.tag'), 'image.tag');
        assert.strictEqual(utils.escapeHelmSetToken('1.2.3'), '1.2.3');
        assert.strictEqual(utils.escapeHelmSetToken(''), '');
    });

    it('keeps legacy behavior when the kill-switch is enabled', () => {
        process.env[flag] = 'true';
        assert.strictEqual(utils.escapeHelmSetToken('x,image.repository=other'), 'x,image.repository=other');
    });
});