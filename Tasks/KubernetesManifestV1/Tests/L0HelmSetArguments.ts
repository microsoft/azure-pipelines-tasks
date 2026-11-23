import * as assert from 'assert';
import * as utils from '../src/utils/utilities';

describe('Helm set argument handling', function () {
    const flag = 'DISTRIBUTEDTASK_TASKS_KUBERNETESMANIFEST_DISABLESTRICTSETARGUMENTS';

    afterEach(() => {
        delete process.env[flag];
    });

    it('escapes separators by default', () => {
        assert.strictEqual(utils.escapeHelmSetToken('x,image.repository=other'), 'x\\,image.repository\\=other');
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
        assert.strictEqual(utils.escapeHelmSetToken('{alpha,beta},x', true), '\\{alpha\\,beta}\\,x');
        assert.strictEqual(utils.escapeHelmSetToken('foo{a,b=1}', true), 'foo{a\\,b=1}');
        assert.strictEqual(utils.escapeHelmSetToken('{a}x{b,c}', true), '\\{a}x{b\\,c}');
        assert.strictEqual(utils.escapeHelmSetToken('{a,{b,c}}', true), '\\{a\\,{b\\,c}}');
        assert.strictEqual(utils.escapeHelmSetToken('{alpha,beta', true), '\\{alpha\\,beta');
    });

    it('preserves literal opening braces and escaped delimiters in flat lists', () => {
        [
            '{{,\\}}',
            '{alpha,{beta,gamma}',
            '{{,a\\,b,c\\}d}',
            '{{,\\\\}',
            '{}'
        ].forEach(value => {
            assert.strictEqual(utils.escapeHelmSetToken(value, true), value, value);
        });
    });

    it('requires the first unescaped list terminator to end the value', () => {
        [
            ['{{,\\}}other.value=next', '\\{{\\,\\}}other.value=next'],
            ['{{,\\}},other.value=next', '\\{{\\,\\}}\\,other.value=next'],
            ['{{,\\}}other.value={next}', '\\{{\\,\\}}other.value={next}'],
            ['{{,\\}', '\\{{\\,\\}'],
            ['{{,tail\\', '\\{{\\,tail\\\\']
        ].forEach(([value, expected]) => {
            assert.strictEqual(utils.escapeHelmSetToken(value, true), expected, value);
        });
    });

    it('escapes equals signs in names and neutralizes trailing list text', () => {
        assert.strictEqual(utils.escapeHelmSetToken('a=b'), 'a\\=b');
        assert.strictEqual(utils.escapeHelmSetToken('{x}k=v', true), '\\{x}k=v');
    });

    it('keeps legacy behavior when the kill-switch is enabled', () => {
        process.env[flag] = 'true';
        assert.strictEqual(utils.escapeHelmSetToken('x,image.repository=other'), 'x,image.repository=other');
        assert.strictEqual(utils.escapeHelmSetToken('{{,\\}}', true), '{{,\\}}');
        assert.strictEqual(utils.escapeHelmSetToken('{{,\\}}other.value=next', true), '{{,\\}}other.value=next');
    });

    it('leaves previously working override syntax unchanged', () => {
        const name = (s: string) => utils.escapeHelmSetToken(s);
        const value = (s: string) => utils.escapeHelmSetToken(s, true);
        assert.strictEqual(value('{alpha,beta}'), '{alpha,beta}');
        assert.strictEqual(value('{80,443}'), '{80,443}');
        assert.strictEqual(value('a\\,b'), 'a\\,b');
        assert.strictEqual(name('ingress.annotations.kubernetes\\.io/ingress\\.class'), 'ingress.annotations.kubernetes\\.io/ingress\\.class');
        assert.strictEqual(value('nginx'), 'nginx');
        assert.strictEqual(value('C:\\\\temp\\\\x'), 'C:\\\\temp\\\\x');
    });

    it('rejects release names that start with a dash and accepts ordinary or empty ones', () => {
        assert.throws(() => utils.validateReleaseName('-flag'), /InvalidReleaseName|starts with '-'/);
        assert.throws(() => utils.validateReleaseName('--set'));
        assert.strictEqual(utils.validateReleaseName('my-release'), 'my-release');
        assert.strictEqual(utils.validateReleaseName(''), '');
        assert.strictEqual(utils.validateReleaseName(undefined), undefined);
    });
});
