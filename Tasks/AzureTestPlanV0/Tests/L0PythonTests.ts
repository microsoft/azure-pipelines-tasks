import assert = require('assert');
import { extractPythonDiscoveredTests } from '../Common/utils';

describe('Python Test Parsing Suite', function () {
    
    it('should correctly parse pytest output without verbose mode', function () {
        // Output from: pytest --collect-only -q -o addopts=
        const output = `test_sample.py::test_addition
test_sample.py::test_subtraction

2 tests collected in 0.00s`;

        const tests = extractPythonDiscoveredTests(output);
        
        assert.strictEqual(tests.length, 2);
        assert.strictEqual(tests[0], 'test_sample.py::test_addition');
        assert.strictEqual(tests[1], 'test_sample.py::test_subtraction');
    });

    it('should fail to parse pytest output with verbose mode (tree format)', function () {
        // Output from: pytest --collect-only -q (when pytest.ini has addopts = -v)
        // This is the BROKEN case that our fix prevents
        const verboseOutput = `============================= test session starts ==============================
platform linux -- Python 3.12.3, pytest-9.0.2, pluggy-1.6.0
rootdir: /tmp/test_fix
configfile: pytest.ini
collected 2 items

<Dir test_fix>
  <Module test_sample.py>
    <Function test_addition>
    <Function test_subtraction>

========================== 2 tests collected in 0.00s ==========================`;

        const tests = extractPythonDiscoveredTests(verboseOutput);
        
        // With verbose output, the parser picks up lines containing ".py"
        // but they are in the wrong format (e.g., "  <Module test_sample.py>")
        // This demonstrates why we need the -o addopts= fix
        assert.notStrictEqual(tests.length, 0, 'Parser should find lines with .py');
        
        // But the parsed lines are NOT in the correct format
        // They should be "test_sample.py::test_addition" but instead we get "  <Module test_sample.py>"
        if (tests.length > 0) {
            assert.ok(!tests[0].includes('::'), 'Verbose output does not have :: separator');
        }
    });

    it('should handle empty output', function () {
        const output = '';
        const tests = extractPythonDiscoveredTests(output);
        assert.strictEqual(tests.length, 0);
    });

    it('should handle output with no tests', function () {
        const output = `============================= test session starts ==============================
platform linux -- Python 3.12.3, pytest-9.0.2, pluggy-1.6.0

========================== no tests ran in 0.00s ===============================`;

        const tests = extractPythonDiscoveredTests(output);
        assert.strictEqual(tests.length, 0);
    });

    it('should correctly parse pytest output with multiple test files', function () {
        const output = `tests/test_module1.py::test_function1
tests/test_module1.py::test_function2
tests/test_module2.py::test_function3
subfolder/tests/test_module3.py::TestClass::test_method

4 tests collected in 0.01s`;

        const tests = extractPythonDiscoveredTests(output);
        
        assert.strictEqual(tests.length, 4);
        assert.strictEqual(tests[0], 'tests/test_module1.py::test_function1');
        assert.strictEqual(tests[1], 'tests/test_module1.py::test_function2');
        assert.strictEqual(tests[2], 'tests/test_module2.py::test_function3');
        assert.strictEqual(tests[3], 'subfolder/tests/test_module3.py::TestClass::test_method');
    });
});
