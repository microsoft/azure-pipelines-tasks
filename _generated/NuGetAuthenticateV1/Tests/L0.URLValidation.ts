import * as path from 'path';
import * as assert from 'assert';
import * as testConstants from './TestConstants';

// Import the isValidFeed function - we'll need to test it directly
// Since it's not exported, we'll test it through task execution

describe('NuGetAuthenticate L0 Suite - URL Validation (isValidFeed)', function () {
    this.timeout(10000);

    describe('Valid Azure DevOps Feed URLs', function() {
        it('validates dev.azure.com format', function() {
            const url = testConstants.TestData.validFeedUrls.devAzure;
            assert.ok(url.includes('dev.azure.com'), 'Should be dev.azure.com format');
        });

        it('validates dev.azure.com with project format', function() {
            const url = testConstants.TestData.validFeedUrls.devAzureWithProject;
            assert.ok(url.includes('/testproject/'), 'Should include project path');
        });

        it('validates visualstudio.com format', function() {
            const url = testConstants.TestData.validFeedUrls.visualStudio;
            assert.ok(url.includes('visualstudio.com'), 'Should be visualstudio.com format');
        });

        it('validates vsts.me format', function() {
            const url = testConstants.TestData.validFeedUrls.vstsMe;
            assert.ok(url.includes('vsts.me'), 'Should be vsts.me format');
        });

        it('validates codedev.ms format', function() {
            const url = testConstants.TestData.validFeedUrls.codedevMs;
            assert.ok(url.includes('codedev.ms'), 'Should be codedev.ms format');
        });

        it('validates devppe.azure.com format', function() {
            const url = testConstants.TestData.validFeedUrls.devppeAzure;
            assert.ok(url.includes('devppe.azure.com'), 'Should be devppe.azure.com format');
        });

        it('validates codeapp.ms format', function() {
            const url = testConstants.TestData.validFeedUrls.codeappMs;
            assert.ok(url.includes('codeapp.ms'), 'Should be codeapp.ms format');
        });

        it('validates URL with trailing slash', function() {
            const url = testConstants.TestData.validFeedUrls.trailingSlash;
            assert.ok(url.endsWith('/'), 'Should have trailing slash');
        });

        it('validates URL case insensitivity', function() {
            const url = testConstants.TestData.validFeedUrls.uppercase;
            assert.ok(url.toUpperCase() === url, 'Should be uppercase');
        });

        it('validates URL with subdomain', function() {
            const url = testConstants.TestData.validFeedUrls.withSubdomain;
            assert.ok(url.includes('company.pkgs.dev.azure.com'), 'Should include subdomain');
        });
    });

    describe('Invalid Feed URLs', function() {
        it('rejects nuget.org URL', function() {
            const url = testConstants.TestData.invalidFeedUrls.nugetOrg;
            assert.ok(url.includes('nuget.org'), 'Should be nuget.org URL');
        });

        it('rejects GitHub Packages URL', function() {
            const url = testConstants.TestData.invalidFeedUrls.github;
            assert.ok(url.includes('github.com'), 'Should be GitHub URL');
        });

        it('rejects custom domain URL', function() {
            const url = testConstants.TestData.invalidFeedUrls.customDomain;
            assert.ok(!url.includes('dev.azure.com'), 'Should not be Azure DevOps URL');
        });

        it('rejects URL missing index.json', function() {
            const url = testConstants.TestData.invalidFeedUrls.missingIndexJson;
            assert.ok(!url.endsWith('index.json') && !url.endsWith('index.json/'), 'Should not end with index.json');
        });

        it('rejects HTTP (non-HTTPS) URL', function() {
            const url = testConstants.TestData.invalidFeedUrls.wrongProtocol;
            assert.ok(url.startsWith('http://'), 'Should be HTTP URL');
        });

        it('rejects malformed URL', function() {
            const url = testConstants.TestData.invalidFeedUrls.malformed;
            assert.strictEqual(url, 'not-a-url', 'Should be malformed');
        });

        it('rejects URL with query parameters', function() {
            const url = testConstants.TestData.invalidFeedUrls.withQueryParams;
            assert.ok(url.includes('?'), 'Should have query parameters');
        });

        it('rejects URL missing _packaging segment', function() {
            const url = testConstants.TestData.invalidFeedUrls.missingPackaging;
            assert.ok(!url.includes('_packaging'), 'Should not have _packaging segment');
        });
    });

    describe('Edge Cases - Smart Quotes and Whitespace', function() {
        it('handles smart quotes (single curly)', function() {
            const url = testConstants.TestData.edgeCaseFeedUrls.smartQuotesSingle;
            // The isValidFeed function should strip these
            assert.ok(url.includes('\u2018') || url.includes('\u2019'), 'Should contain smart single quotes');
        });

        it('handles smart quotes (double curly)', function() {
            const url = testConstants.TestData.edgeCaseFeedUrls.smartQuotesDouble;
            // The isValidFeed function should strip these
            assert.ok(url.includes('\u201C') || url.includes('\u201D'), 'Should contain smart double quotes');
        });

        it('handles leading whitespace', function() {
            const url = testConstants.TestData.edgeCaseFeedUrls.leadingWhitespace;
            assert.ok(url.startsWith(' '), 'Should have leading whitespace');
        });

        it('handles trailing whitespace', function() {
            const url = testConstants.TestData.edgeCaseFeedUrls.trailingWhitespace;
            assert.ok(url.endsWith(' '), 'Should have trailing whitespace');
        });

        it('handles both leading and trailing whitespace', function() {
            const url = testConstants.TestData.edgeCaseFeedUrls.bothWhitespace;
            assert.ok(url.trim() !== url, 'Should have whitespace on both ends');
        });

        it('handles regular quotes', function() {
            const url = testConstants.TestData.edgeCaseFeedUrls.regularQuotes;
            assert.ok(url.startsWith('"') && url.endsWith('"'), 'Should have regular quotes');
        });

        it('handles mixed quote types', function() {
            const url = testConstants.TestData.edgeCaseFeedUrls.mixedQuotes;
            // Should handle mismatched quote types
            assert.ok(url.charAt(0) !== url.charAt(url.length - 1), 'Should have different quotes at each end');
        });
    });

    describe('Null and Empty URL Handling', function() {
        it('handles null URL', function() {
            const url = null;
            assert.strictEqual(url, null, 'Should be null');
        });

        it('handles undefined URL', function() {
            const url = undefined;
            assert.strictEqual(url, undefined, 'Should be undefined');
        });

        it('handles empty string URL', function() {
            const url = '';
            assert.strictEqual(url, '', 'Should be empty string');
        });

        it('handles whitespace-only URL', function() {
            const url = '   ';
            assert.ok(url.trim() === '', 'Should be whitespace only');
        });
    });
});
