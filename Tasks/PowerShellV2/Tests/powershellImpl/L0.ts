import path = require('path');
var psm = require('../../../../Tests/lib/psRunner');
var psr = null;

export const runPowershellSuite = () => {
    describe('PowerShell Impl Suite', function () {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        before((done) => {
            if (psm.testSupported()) {
                psr = new psm.PSRunner();
                psr.start();
            }

            done();
        });

        after(function () {
            if (psr) {
                psr.kill();
            }
        });

        if (psm.testSupported()) {
            it('Should parse a simple argument string', (done) => {
                psr.run(path.join(__dirname, 'ShouldParseSimpleArgumentString.ps1'), done);
            })

            it('Should handle env variable content as single arg', (done) => {
                psr.run(path.join(__dirname, 'ShouldHandleEnvVariableContentAsSingleArg.ps1'), done);
            })

            it('Should handle env variable content as single arg 2', (done) => {
                psr.run(path.join(__dirname, 'ShouldHandleEnvVariableContentAsSingleArg2.ps1'), done);
            })

            it('Should handle env variable content as single arg 3', (done) => {
                psr.run(path.join(__dirname, 'ShouldHandleEnvVariableContentAsSingleArg3.ps1'), done);
            })

            it('Should handle quoted arguments', (done) => {
                psr.run(path.join(__dirname, 'ShouldHandleQuotedArguments.ps1'), done);
            })

            it('Should handle quoted arguments with 2 spaces inside', (done) => {
                psr.run(path.join(__dirname, 'ShouldHandleQuotedArgumentsWith2SpacesInside.ps1'), done);
            })

            it('Should ignore spaces between non-quoted args', (done) => {
                psr.run(path.join(__dirname, 'ShouldIgnoreSpacesBetweenNonQuotedArgs.ps1'), done);
            })

            it('Should ignore spaces between non-quoted args', (done) => {
                psr.run(path.join(__dirname, 'ShouldHandleEscapedChars.ps1'), done);
            })

            it('Should handle string with single quotes', (done) => {
                psr.run(path.join(__dirname, 'ShouldHandleStringWithSingleQuotes.ps1'), done);
            });

            it('Should handle argument in single quotes properly', (done) => {
                psr.run(path.join(__dirname, 'ShouldHandleArgumentInSingleQuotesProperly.ps1'), done);
            });

            it('Should handle escaped backslashes', (done) => {
                psr.run(path.join(__dirname, 'ShouldHandleEscapedBackslashes.ps1'), done);
            });

            it('Should handle args with backslash', (done) => {
                psr.run(path.join(__dirname, 'ShouldHandleArgsWithBackslash.ps1'), done);
            });

            it('Escaped escape character passed as a separate argument should present', (done) => {
                psr.run(path.join(__dirname, 'EscapedEscapeCharacterPassedAsASeparateArgumentShouldPresent.ps1'), done);
            });

            it('Single escape character passed as a separate argument should be ignored', (done) => {
                psr.run(path.join(__dirname, 'SingleEscapeCharacterPassedAsASeparateArgumentShouldBeIgnored.ps1'), done);
            });

            it('Escaped escape character should present in args when inside a double quotes', (done) => {
                psr.run(path.join(__dirname, 'EscapedEscapeCharacterShouldPresentInArgsWhenInsideADoubleQuotes.ps1'), done);
            });

            it('Should handle multiple quote types properly', (done) => {
                psr.run(path.join(__dirname, 'ShouldHandleMultipleQuoteTypesProperly.ps1'), done);
            });

            it('Should handle multiple quote types properly 2', (done) => {
                psr.run(path.join(__dirname, 'ShouldHandleMultipleQuoteTypesProperly2.ps1'), done);
            });

            it('Single escape inside quoted argument should make no sense', (done) => {
                psr.run(path.join(__dirname, 'SingleEscapeInsideQuotedArgumentShouldMakeNoSense.ps1'), done);
            });

            it('Single escape character should present in args when inside a double quotes', (done) => {
                psr.run(path.join(__dirname, 'SingleEscapeCharacterShouldPresentInArgsWhenInsideADoubleQuotes.ps1'), done);
            });

            it('Escape character should present in args when inside a single quotes', (done) => {
                psr.run(path.join(__dirname, 'EscapeCharacterShouldPresentInArgsWhenInsideASingleQuotes.ps1'), done);
            });

            it('Separate quotes which are inside other should be present in result string', (done) => {
                psr.run(path.join(__dirname, 'SeparateQuotesWhichAreInsideOtherShouldBePresentInResultString.ps1'), done);
            });

            it('Should get env variable from argument', (done) => {
                psr.run(path.join(__dirname, 'ShouldGetEnvVariableFromArgument.ps1'), done);
            });

            it('Should get env variables from argument', (done) => {
                psr.run(path.join(__dirname, 'ShouldGetEnvVariablesFromArgument.ps1'), done);
            });

            it('Should leave empty if no variable specified', (done) => {
                psr.run(path.join(__dirname, 'ShouldLeaveEmptyIfNoVariableSpecified.ps1'), done);
            });

            it('Should leave var name if escaped', (done) => {
                psr.run(path.join(__dirname, 'ShouldLeaveVarNameIfEscaped.ps1'), done);
            });

            it('Should process var name if escaped escape', (done) => {
                psr.run(path.join(__dirname, 'ShouldProcessVarNameIfEscapedEscape.ps1'), done);
            });

            it('Should leave empty if escaped', (done) => {
                psr.run(path.join(__dirname, 'ShouldLeaveEmptyIfEscaped.ps1'), done);
            });

            it('Should ignore variables inside expansion syntax', (done) => {
                psr.run(path.join(__dirname, 'ShouldIgnoreVariablesInsideExpansionSyntax.ps1'), done);
            });

            it('Should break envs processing in case of unmatched expansion', (done) => {
                psr.run(path.join(__dirname, 'ShouldBreakEnvsProcessingInCaseOfUnmatchedExpansion.ps1'), done);
            });

            for (let i = 1; i < 3; i++) {
                it(`Should not handle env vars with braced syntax #${i}`, (done) => {
                    psr.run(path.join(__dirname, `ShouldNotHandleEnvVarsWithBracedSyntax${i}.ps1`), done);
                });
            }
        }
    });
}
