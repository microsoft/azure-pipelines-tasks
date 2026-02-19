// Test file to verify the stripAnsiCodes function works correctly
// This simulates what the fix will do in job.ts

/**
 * Strips ANSI escape codes and Jenkins pipeline annotations from console output.
 * Newer Jenkins versions include these codes which appear as junk in ADO logs.
 */
function stripAnsiCodes(text: string): string {
    if (!text) {
        return text;
    }
    return text
        // Remove standard ANSI escape codes (colors, cursor movement, formatting)
        // Matches: ESC[0m, ESC[32m, ESC[1;31m, etc.
        .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
        // Remove Jenkins Pipeline console notes [8mha:////...[0m
        .replace(/\[8mha:[\s\S]*?\[0m/g, '')
        // Remove literal \033[...m sequences (shown in command echo)
        .replace(/\\033\[[0-9;]*m/g, '')
        // Remove orphaned bracket codes [0m, [32m, [1;31m, etc. (leftover after ESC stripped)
        .replace(/\[[0-9;]*m/g, '');
}

// ============================================================
// TEST CASES
// ============================================================

console.log('='.repeat(70));
console.log('TESTING stripAnsiCodes() FUNCTION');
console.log('='.repeat(70));

// Test 1: ANSI color codes
console.log('\n--- Test 1: ANSI Color Codes ---');
const test1Input = '\x1B[32m✓ SUCCESS: This is green text\x1B[0m';
const test1Expected = '✓ SUCCESS: This is green text';
const test1Result = stripAnsiCodes(test1Input);
console.log('Input:    ', JSON.stringify(test1Input));
console.log('Expected: ', JSON.stringify(test1Expected));
console.log('Result:   ', JSON.stringify(test1Result));
console.log('PASS:', test1Result === test1Expected ? '✓' : '✗');

// Test 2: Multiple ANSI codes
console.log('\n--- Test 2: Multiple ANSI Codes ---');
const test2Input = '\x1B[32mGreen\x1B[0m and \x1B[31mRed\x1B[0m';
const test2Expected = 'Green and Red';
const test2Result = stripAnsiCodes(test2Input);
console.log('Input:    ', JSON.stringify(test2Input));
console.log('Expected: ', JSON.stringify(test2Expected));
console.log('Result:   ', JSON.stringify(test2Result));
console.log('PASS:', test2Result === test2Expected ? '✓' : '✗');

// Test 3: Jenkins pipeline annotations
console.log('\n--- Test 3: Jenkins Pipeline Annotations ---');
const test3Input = '[8mha:////4ABC123xyz[0mActual log content';
const test3Expected = 'Actual log content';
const test3Result = stripAnsiCodes(test3Input);
console.log('Input:    ', JSON.stringify(test3Input));
console.log('Expected: ', JSON.stringify(test3Expected));
console.log('Result:   ', JSON.stringify(test3Result));
console.log('PASS:', test3Result === test3Expected ? '✓' : '✗');

// Test 4: Normal text (no codes)
console.log('\n--- Test 4: Normal Text (No Codes) ---');
const test4Input = 'Normal text without any codes';
const test4Expected = 'Normal text without any codes';
const test4Result = stripAnsiCodes(test4Input);
console.log('Input:    ', JSON.stringify(test4Input));
console.log('Expected: ', JSON.stringify(test4Expected));
console.log('Result:   ', JSON.stringify(test4Result));
console.log('PASS:', test4Result === test4Expected ? '✓' : '✗');

// Test 5: Empty/null handling
console.log('\n--- Test 5: Empty/Null Handling ---');
const test5aResult = stripAnsiCodes('');
const test5bResult = stripAnsiCodes(null);
console.log('Empty string result:', JSON.stringify(test5aResult), '- PASS:', test5aResult === '' ? '✓' : '✗');
console.log('Null result:', test5bResult, '- PASS:', test5bResult === null ? '✓' : '✗');

// Test 6: Mixed content (both ANSI and Jenkins annotations)
console.log('\n--- Test 6: Mixed Content ---');
const test6Input = '[8mha:////4KT4[0m\x1B[32mSuccess\x1B[0m - Build completed';
const test6Expected = 'Success - Build completed';
const test6Result = stripAnsiCodes(test6Input);
console.log('Input:    ', JSON.stringify(test6Input));
console.log('Expected: ', JSON.stringify(test6Expected));
console.log('Result:   ', JSON.stringify(test6Result));
console.log('PASS:', test6Result === test6Expected ? '✓' : '✗');

// Test 7: REAL Jenkins output (from your actual Jenkins server)
console.log('\n--- Test 7: REAL Jenkins Output ---');
const realJenkinsOutput = `[8mha:////4KT4NXLmwEeaSqBbQWhmdN1AcDjxdaA3DirwEYhRaKjJAAAAlx+LCAAAAAAAAP9b85aBtbiIQTGjNKU4P08vOT+vOD8nVc83PyU1x6OyILUoJzMv2y+/JJUBAhiZGBgqihhk0NSjKDWzXb3RdlLBUSYGJk8GtpzUvPSSDB8G5tKinBIGIZ+sxLJE/ZzEvHT94JKizLx0a6BxUmjGOUNodHsLgAzWEgZu/dLi1CL9xJTczDwAj6GcLcAAAAA=[0madmin
[8mha:////4AM4Lnu5e+qCM7xa3pNwrG+EeXuedRuh6TkbLVWYNntIAAAAoh+LCAAAAAAAAP9tjTEOwjAQBM8BClpKHuFItIiK1krDC0x8GCfWnbEdkooX8TX+gCESFVvtrLSa5wtWKcKBo5UdUu8otU4GP9jS5Mixv3geZcdn2TIl9igbHBs2eJyx4YwwR1SwULBGaj0nRzbDRnX6rmuvydanHMu2V1A5c4MHCFXMWcf8hSnC9jqYxPTz/BXAFEIGsfuclm8zQVqFvQAAAA==[0m[Pipeline] Start of Pipeline
+ echo -e \\033[32m✓ SUCCESS: This is green text\\033[0m
-e [32m✓ SUCCESS: This is green text[0m
+ echo -e \\033[31m✗ ERROR: This is red text\\033[0m
-e [31m✗ ERROR: This is red text[0m
[8mha:////4LRz8uRRAwHqy4nOySO0FcoCaMpggFctIoE9onG5EGyOAAAAox+LCAAAAAAAAP9tjTEOwjAQBDdBFLSUPMKBDglR0VppeIFJjHFi3QX7QlLxIr7GH4iIRMVWO9PM641lijhydKqx1HpKlVdd6N301MCxvQYeVMMXVTElDlaVdii5tqcZSxaLeVmOhcbKUhU4eXKCtW7MwxTBkCvOEid30Mh9fccTmZ7KYqJ8YYzY3Po6Mf06fwMYu06Q77aCbP8Brmfz270AAAA=[0m[Pipeline] }
Finished: SUCCESS`;

console.log('Input (first 200 chars):');
console.log(realJenkinsOutput.substring(0, 200) + '...');
console.log('\nStripped output:');
const strippedReal = stripAnsiCodes(realJenkinsOutput);
console.log(strippedReal);

// Summary
console.log('\n' + '='.repeat(70));
console.log('TEST SUMMARY');
console.log('='.repeat(70));
const allPassed = 
    test1Result === test1Expected &&
    test2Result === test2Expected &&
    test3Result === test3Expected &&
    test4Result === test4Expected &&
    test5aResult === '' &&
    test5bResult === null &&
    test6Result === test6Expected;

if (allPassed) {
    console.log('✓ ALL TESTS PASSED! The stripAnsiCodes function is working correctly.');
} else {
    console.log('✗ SOME TESTS FAILED! Please check the output above.');
}
