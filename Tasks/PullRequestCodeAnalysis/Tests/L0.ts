/// <reference path="../typings/index.d.ts" />

import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';
import * as chai from 'chai';
import { expect } from 'chai';
import * as Q from 'q';

import * as ttm from 'vsts-task-lib/mock-test';

import { GitPullRequestCommentThread, Comment } from 'vso-node-api/interfaces/GitInterfaces';
import { IGitApi } from 'vso-node-api/GitApi';
import * as web from 'vso-node-api/WebApi';
import { WebApi } from 'vso-node-api/WebApi';

import { Message } from '../PRCA/Message';
import { SonarQubeReportProcessor } from '../PRCA/SonarQubeReportProcessor';
import { PrcaService } from '../PRCA/PrcaService';
import { PrcaOrchestrator } from '../PRCA/PrcaOrchestrator';
import { PRInjectorError } from '../PRCA/PRInjectorError';

import { TestLogger } from './TestLogger';
import { MockPrcaService } from './mocks/MockPrcaService';
import { MockSonarQubeReportProcessor } from './mocks/MockSonarQubeReportProcessor';
import {ConfigurableGitApi } from './mocks/ConfigurableGitApi';
import {ErrorTarget} from './mocks/ErrorTarget';

var mochaAsync = (fn: Function) => {
    return async (done: Function) => {
        try {
            await fn();
            done();
        } catch (err) {
            done(err);
        }
    };
};

function VerifyMessage(
    actualMessage: Message,
    expectedContent: string,
    expectedFile: string,
    expectedLine: number,
    expectedPriority: number) {

    chai.expect(actualMessage.content).to.equal(expectedContent, 'Content mismatch');
    chai.expect(actualMessage.file).to.equal(expectedFile, 'File mismatch');
    chai.expect(actualMessage.line).to.equal(expectedLine, 'Line mismatch');
    chai.expect(actualMessage.priority).to.equal(expectedPriority, 'Priority mismatch');
}

function AssertMessageInStdout(stdout: string, message:string):void {
    assert(stdout.indexOf(message) > -1, `Expected to see message in stdout, but did not: "${message}"`);
}

describe('The PRCA', function () {
    describe('unit', () => {
        describe('Orchestrator', () => {

            let fakeMessage: Message = new Message('foo bar', './foo/bar.txt', 1, 1);

            before(() => {
                Q.longStackSupport = true;
            });

            context('fails when it', () => {
                let testLogger: TestLogger;
                let server: MockPrcaService;
                let sqReportProcessor: SonarQubeReportProcessor;
                let orchestrator: PrcaOrchestrator; // object under test

                beforeEach(() => {
                    testLogger = new TestLogger();
                    server = new MockPrcaService();
                    sqReportProcessor = new SonarQubeReportProcessor(testLogger);
                    orchestrator = new PrcaOrchestrator(testLogger, sqReportProcessor, server);
                });

                it('is called with invalid arguments', () => {
                    var message: any = undefined;

                    // Arrange
                    var expectedMessages: Message[] = [fakeMessage, fakeMessage];
                    server.createCodeAnalysisThreads(expectedMessages); // post some messages to test that the orchestrator doesn't delete them

                    // Act & Assert
                    expect(() => orchestrator.postSonarQubeIssuesToPullRequest(undefined)).to.throw(Error, /Make sure a SonarQube enabled build task ran before this step./);
                    expect(() => orchestrator.postSonarQubeIssuesToPullRequest(null)).to.throw(Error, /Make sure a SonarQube enabled build task ran before this step./);
                    expect(server.getSavedMessages()).to.eql(expectedMessages, 'Expected existing PRCA messages to still be on the server');
                });

                it('fails retrieving the list of files in the pull request', () => {
                    // Arrange
                    var expectedMessages: Message[] = [fakeMessage, fakeMessage];
                    server.createCodeAnalysisThreads(expectedMessages); // post some messages to test that the orchestrator doesn't delete them
                    server.getModifiedFilesInPr_shouldFail = true;
                    var sqReportPath: string = path.join(__dirname, 'data', 'sonar-report.json');

                    // Act
                    return orchestrator.postSonarQubeIssuesToPullRequest(sqReportPath)
                        .then(() => {
                            return Promise.reject('Should not have finished successfully');
                        }, (error) => {
                            // We expect to fail
                            expect(server.getSavedMessages()).to.eql(expectedMessages, 'Expected existing PRCA messages to still be on the server');
                            return Promise.resolve(true);
                        });
                });

                it('fails deleting old PRCA comments', () => {
                    // Arrange
                    var expectedMessages: Message[] = [fakeMessage, fakeMessage];
                    server.createCodeAnalysisThreads(expectedMessages); // post some messages to test that the orchestrator doesn't delete them
                    server.deleteCodeAnalysisComments_shouldFail = true;
                    var sqReportPath: string = path.join(__dirname, 'data', 'sonar-report.json');

                    // Act
                    return orchestrator.postSonarQubeIssuesToPullRequest(sqReportPath)
                        .then(() => {
                            return Promise.reject('Should not have finished successfully');
                        }, (error) => {
                            // We expect to fail
                            expect(server.getSavedMessages()).to.eql(expectedMessages, 'Expected existing PRCA messages to still be on the server');
                            return Promise.resolve(true);
                        });
                });

                it('fails posting new PRCA comments', () => {
                    // Arrange
                    var oldMessages: Message[] = [fakeMessage, fakeMessage];
                    server.createCodeAnalysisThreads(oldMessages); // post some messages to test that the orchestrator deletes them
                    server.createCodeAnalysisThreads_shouldFail = true;
                    var sqReportPath: string = path.join(__dirname, 'data', 'sonar-report.json');

                    // Act
                    return orchestrator.postSonarQubeIssuesToPullRequest(sqReportPath)
                        .then(() => {
                            return Promise.reject('Should not have finished successfully');
                        }, (error) => {
                            // We expect to fail
                            expect(server.getSavedMessages()).to.have.length(0, 'Expected old PRCA comments to have been deleted');
                            return Promise.resolve(true);
                        });
                });
            });

            context('succeeds when it', () => {
                let testLogger: TestLogger;
                let server: MockPrcaService;
                let sqReportProcessor: SonarQubeReportProcessor;
                let orchestrator: PrcaOrchestrator; // object under test

                beforeEach(() => {
                    testLogger = new TestLogger();
                    server = new MockPrcaService();
                    sqReportProcessor = new SonarQubeReportProcessor(testLogger);
                    orchestrator = new PrcaOrchestrator(testLogger, sqReportProcessor, server);
                });

                it('has no comments to post (no issues reported)', () => {
                    // Arrange
                    // no changed files => new files to post issues on
                    var oldMessages: Message[] = [fakeMessage, fakeMessage];
                    server.createCodeAnalysisThreads(oldMessages); // post some messages to test that the orchestrator deletes them
                    server.setModifiedFilesInPr([]);
                    var sqReportPath: string = path.join(__dirname, 'data', 'sonar-no-issues.json');

                    // Act
                    return orchestrator.postSonarQubeIssuesToPullRequest(sqReportPath)
                        .then(() => {
                            // Assert
                            expect(server.getSavedMessages()).to.have.length(0, 'Correct number of comments');
                        });
                });

                it('has no comments to post (no issues in changed files)', () => {
                    // Arrange
                    var oldMessages: Message[] = [fakeMessage, fakeMessage];
                    server.createCodeAnalysisThreads(oldMessages); // post some messages to test that the orchestrator deletes them
                    server.setModifiedFilesInPr([]);
                    var sqReportPath: string = path.join(__dirname, 'data', 'sonar-no-new-issues.json');

                    // Act
                    return orchestrator.postSonarQubeIssuesToPullRequest(sqReportPath)
                        .then(() => {
                            // Assert
                            expect(server.getSavedMessages()).to.have.length(0, 'Correct number of comments');
                        });
                });

                it('has 1 comment to post', () => {
                    // Arrange
                    var oldMessages: Message[] = [fakeMessage, fakeMessage];
                    server.createCodeAnalysisThreads(oldMessages); // post some messages to test that the orchestrator deletes them
                    server.setModifiedFilesInPr(['src/test/java/com/mycompany/app/AppTest.java']);
                    var sqReportPath: string = path.join(__dirname, 'data', 'sonar-report.json');

                    // Act
                    return orchestrator.postSonarQubeIssuesToPullRequest(sqReportPath)
                        .then(() => {
                            // Assert
                            expect(server.getSavedMessages()).to.have.length(1, 'Correct number of comments');
                        });
                });

                it('has multiple comments to post', () => {
                    // Arrange
                    server.setModifiedFilesInPr(['src/main/java/com/mycompany/app/App.java']);
                    var sqReportPath: string = path.join(__dirname, 'data', 'sonar-report.json');

                    // Act
                    return orchestrator.postSonarQubeIssuesToPullRequest(sqReportPath)
                        .then(() => {
                            // Assert
                            expect(server.getSavedMessages()).to.have.length(2, 'Correct number of comments');
                        });
                });

                it(`has more comments to post than the limit allows`, () => {
                    // Arrange
                    server.setModifiedFilesInPr(['src/main/java/com/mycompany/app/App.java']);
                    var sqReportPath: string = path.join(__dirname, 'data', 'sonar-no-issues.json');
                    let mockSqReportProcessor: MockSonarQubeReportProcessor = new MockSonarQubeReportProcessor();
                    let orchestrator: PrcaOrchestrator =
                        new PrcaOrchestrator(testLogger, mockSqReportProcessor, server);

                    let messages = new Array<Message>(orchestrator.getMessageLimit() + 50);
                    // Set (getMessageLimit() + 50) messages to return
                    for (var i = 0; i < orchestrator.getMessageLimit() + 50; i++) {
                        let message: Message;
                        // Some of the messages will have a higher priority, so that we can check that they have all been posted
                        if (i < orchestrator.getMessageLimit() + 30) {
                            message = new Message('foo', 'src/main/java/com/mycompany/app/App.java', 1, 2);
                        } else {
                            message = new Message('bar', 'src/main/java/com/mycompany/app/App.java', 1, 1);
                        }
                        messages.push(message);
                    }
                    mockSqReportProcessor.SetCommentsToReturn(messages);

                    // Act
                    return orchestrator.postSonarQubeIssuesToPullRequest(sqReportPath)
                        .then(() => {
                            // Assert
                            expect(server.getSavedMessages()).to.have.length(orchestrator.getMessageLimit(), 'Correct number of comments');

                            var priorityOneThreads = server.getSavedMessages().filter(
                                (message: Message) => {
                                    return message.content == 'bar';
                                }
                            );
                            expect(priorityOneThreads).to.have.length(20, 'High priority comments were all posted');
                        });
                });

                it(`has more high-priority comments to post than the limit allows`, () => {
                    // Arrange
                    server.setModifiedFilesInPr(['src/main/java/com/mycompany/app/App.java']);
                    var sqReportPath: string = path.join(__dirname, 'data', 'sonar-no-issues.json');
                    let mockSqReportProcessor: MockSonarQubeReportProcessor = new MockSonarQubeReportProcessor();
                    let orchestrator: PrcaOrchestrator =
                        new PrcaOrchestrator(testLogger, mockSqReportProcessor, server);

                    let messages = new Array<Message>(orchestrator.getMessageLimit() + 50);
                    // Set (getMessageLimit() + 50) messages to return
                    for (var i = 0; i < orchestrator.getMessageLimit() + 50; i++) {
                        let message: Message;
                        // (getMessageLimit() + 20 of the messages are high priority, so we expect all posted messages to be at the highest priority
                        if (i < 30) {
                            message = new Message('foo', 'src/main/java/com/mycompany/app/App.java', 1, 2);
                        } else {
                            message = new Message('bar', 'src/main/java/com/mycompany/app/App.java', 1, 1);
                        }
                        messages.push(message);
                    }
                    mockSqReportProcessor.SetCommentsToReturn(messages);

                    // Act

                    return orchestrator.postSonarQubeIssuesToPullRequest(sqReportPath)
                        .then(() => {
                            // Assert
                            expect(server.getSavedMessages()).to.have.length(orchestrator.getMessageLimit(), 'Correct number of comments');

                            var priorityOneThreads = server.getSavedMessages().filter(
                                (message: Message) => {
                                    return message.content == 'bar';
                                }
                            );
                            expect(priorityOneThreads).to.have.length(orchestrator.getMessageLimit(), 'All posted comments were high priority');
                        });
                });

                it(`is given a different comment limit`, () => {
                    // Arrange
                    server.setModifiedFilesInPr(['src/main/java/com/mycompany/app/App.java']);
                    var sqReportPath: string = path.join(__dirname, 'data', 'sonar-no-issues.json');

                    let mockSqReportProcessor: MockSonarQubeReportProcessor = new MockSonarQubeReportProcessor();
                    let messages = new Array<Message>(10);
                    // Set 10 messages to return
                    for (var i = 0; i < 10; i++) {
                        messages.push(new Message('bar', 'src/main/java/com/mycompany/app/App.java', 1, 1));
                    }
                    mockSqReportProcessor.SetCommentsToReturn(messages);

                    // Act
                    let orchestrator: PrcaOrchestrator =
                        new PrcaOrchestrator(testLogger, mockSqReportProcessor, server, 5); // set a message limit of 5

                    return orchestrator.postSonarQubeIssuesToPullRequest(sqReportPath)
                        .then(() => {
                            // Assert
                            expect(server.getSavedMessages()).to.have.length(orchestrator.getMessageLimit(), 'Correct number of comments');

                            var correctThreads = server.getSavedMessages().filter(
                                (message: Message) => {
                                    return message.content == 'bar';
                                }
                            );
                            expect(correctThreads).to.have.length(orchestrator.getMessageLimit(), 'All posted comments had correct content');
                        });
                });
            });
        });

        describe('Report Processor', () => {
            context('fails when', () => {
                let sqReportProcessor: SonarQubeReportProcessor;
                let testLogger: TestLogger;

                beforeEach(() => {
                    testLogger = new TestLogger();
                    sqReportProcessor = new SonarQubeReportProcessor(testLogger);
                });

                it('the report path is null', () => {
                    chai.expect(() => sqReportProcessor.FetchCommentsFromReport(null)).to.throw(ReferenceError);
                });

                it('the report is not on disk', () => {
                    let nonExistentReport: string = '/tmp/bogus.txt';
                    chai.expect(() => sqReportProcessor.FetchCommentsFromReport(nonExistentReport)).to.throw(PRInjectorError);
                });

                it('the report is not in json format', () => {
                    let invalidJsonReport: string = path.join(__dirname, 'data', 'invalid-sonar-report.json');
                    fs.accessSync(invalidJsonReport, fs.F_OK);
                    chai.expect(() => sqReportProcessor.FetchCommentsFromReport(invalidJsonReport)).to.throw(PRInjectorError);
                });
            });

            context('succeeds when', () => {
                let sqReportProcessor: SonarQubeReportProcessor;
                let testLogger: TestLogger;

                beforeEach(() => {
                    testLogger = new TestLogger();
                    sqReportProcessor = new SonarQubeReportProcessor(testLogger);
                });

                it('the report has no components', () => {
                    let emptyReport = path.join(__dirname, 'data', 'empty-sonar-report.json');
                    var messages = sqReportProcessor.FetchCommentsFromReport(emptyReport);

                    chai.expect(messages).to.have.length(0, 'There are no issues');
                });

                it('the report has no new components', () => {
                    let report = path.join(__dirname, 'data', 'sonar-no-new-issues.json');
                    var messages = sqReportProcessor.FetchCommentsFromReport(report);

                    chai.expect(messages).to.have.length(0, 'There are no issues');
                });

                it('the report has no issues', () => {
                    let emptyReport = path.join(__dirname, 'data', 'empty-sonar-report.json');
                    var messages = sqReportProcessor.FetchCommentsFromReport(emptyReport);

                    chai.expect(messages).to.have.length(0, 'There are no issues');
                });

                it('the report is valid', () => {

                    // Arrange
                    let validReport = path.join(__dirname, 'data', 'sonar-report.json');
                    let testLogger = new TestLogger();

                    // Act
                    let sqReportProcessor: SonarQubeReportProcessor = new SonarQubeReportProcessor(testLogger);
                    let messages: Message[] = sqReportProcessor.FetchCommentsFromReport(validReport);

                    // Assert
                    chai.expect(messages).to.have.length(3, 'There are 3 new issues in the report');

                    // valid issue
                    VerifyMessage(
                        messages[0],
                        'Remove this unused "x" local variable. (squid:S1481)',
                        'src/main/java/com/mycompany/app/App.java',
                        12,
                        3);

                    // another valid issue in a different file
                    VerifyMessage(
                        messages[1],
                        'Replace this usage of System.out or System.err by a logger. (squid:S106)',
                        'src/test/java/com/mycompany/app/AppTest.java',
                        11,
                        4);

                    // issue with no priority
                    VerifyMessage(
                        messages[2],
                        'Bad code right here... (squid:S106)',
                        'src/main/java/com/mycompany/app/App.java',
                        15,
                        6);

                    chai.expect(testLogger.Warnings).to.have.length(2, 'There should be warnings for the issues with invalid line numbers');
                });
            });
        });

        describe('PRCA Service (server-side interaction)', () => {

            describe('createCodeAnalysisThreads', () => {
                it('works when posting a single message', mochaAsync(async (done: Function) => {

                    // Arrange
                    let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
                    let logger: TestLogger = new TestLogger();
                    let prcaService: PrcaService = new PrcaService(logger, mockGitApi, 'repoId', 15);

                    mockGitApi.configurePRIterations([1]);
                    let message = new Message('bla bla', 'file1.cs', 14, 2);

                    // Act
                    await prcaService.createCodeAnalysisThreads([message]);

                    // Assert
                    var threads = mockGitApi.ExistingThreads;
                    chai.expect(threads).to.have.length(1);
                    ConfigurableGitApi.validateThreadAgainstMessge(message, threads[0], 1);
                }));

                it('works when posting several messages', mochaAsync(async (done: Function) => {

                    // Arrange
                    let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
                    let logger: TestLogger = new TestLogger();
                    let prcaService: PrcaService = new PrcaService(logger, mockGitApi, 'repoId', 15);

                    mockGitApi.configurePRIterations([1, 2, 3]);

                    let message1 = new Message('M1', 'file1.cs', 14, 2);
                    let message2 = new Message('M2', 'file1.cs', 15, 4);
                    let message3 = new Message('M3', 'file3.cs', 22, 1);

                    // Act
                    await prcaService.createCodeAnalysisThreads([message1, message2, null, message3, null]);

                    // Assert
                    chai.expect(mockGitApi.ExistingThreads).to.have.length(3);
                    ConfigurableGitApi.validateThreadAgainstMessge(message1, mockGitApi.ExistingThreads[0], 3);
                    ConfigurableGitApi.validateThreadAgainstMessge(message2, mockGitApi.ExistingThreads[1], 3);
                    ConfigurableGitApi.validateThreadAgainstMessge(message3, mockGitApi.ExistingThreads[2], 3);
                }));

                it('fails if getPullRequestIterations fails', async (done) => {

                    // Arrange
                    let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
                    let logger: TestLogger = new TestLogger();
                    let prcaService: PrcaService = new PrcaService(logger, mockGitApi, 'repoId', 15);
                    let message = new Message('bla bla', 'file1.cs', 14, 2);

                    mockGitApi.configurePRIterations([1]);
                    mockGitApi.configureException(ErrorTarget.getPullRequestIterations);


                    // Act
                    try {
                        await prcaService.createCodeAnalysisThreads([message]);
                        done('Expected createCodeAnalysisThreads to have failed');
                    } catch (e) {
                        chai.expect(e.message).to.equal(ConfigurableGitApi.ExpectedExceptionText);
                        done();
                    }
                });

                it('fails if createThread fails', async (done) => {

                    // Arrange
                    let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
                    let logger: TestLogger = new TestLogger();
                    let prcaService: PrcaService = new PrcaService(logger, mockGitApi, 'repoId', 15);
                    let message = new Message('bla bla', 'file1.cs', 14, 2);

                    mockGitApi.configurePRIterations([1]);
                    mockGitApi.configureException(ErrorTarget.createThread);

                    // Act
                    try {
                        await prcaService.createCodeAnalysisThreads([message]);
                        done('Expected createCodeAnalysisThreads to have failed');
                    } catch (e) {
                        chai.expect(e.message).to.equal(ConfigurableGitApi.ExpectedExceptionText);
                        done();
                    }
                });
            });

            describe('getModifiedFilesInPr', () => {
                it('works if the PR has 1 iteration', mochaAsync(async (done: Function) => {

                    // Arrange
                    let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
                    let logger: TestLogger = new TestLogger();
                    let prcaService: PrcaService = new PrcaService(logger, mockGitApi, 'repoId', 15);

                    mockGitApi.configurePRIterations([1]);
                    mockGitApi.configurePrIterationChanges(1, ['file1.cs', 'file2.cs']);

                    // Act
                    let files = await prcaService.getModifiedFilesInPr();

                    // Assert
                    chai.expect(files.sort()).to.eql(['file1.cs', 'file2.cs']);
                }));

                it('works if the PR has multiple iterations', mochaAsync(async (done: Function) => {

                    // Arrange
                    let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
                    let logger: TestLogger = new TestLogger();
                    let prcaService: PrcaService = new PrcaService(logger, mockGitApi, 'repoId', 15);

                    mockGitApi.configurePRIterations([1, 3, 5, 7]);
                    mockGitApi.configurePrIterationChanges(1, ['file1.cs', 'file2.cs']);
                    mockGitApi.configurePrIterationChanges(3, ['file1.cs', 'file3.cs']);
                    mockGitApi.configurePrIterationChanges(5, ['file1.cs', 'file5.cs']);
                    mockGitApi.configurePrIterationChanges(7, ['file1.cs', 'file2.cs', 'file3.cs']);

                    // Act
                    let files = await prcaService.getModifiedFilesInPr();

                    // Assert
                    chai.expect(files.sort()).to.eql(['file1.cs', 'file2.cs', 'file3.cs', 'file5.cs']);
                }));

                it('fails if getPullRequestIterations also fails', async (done) => {

                    // Arrange
                    let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
                    let logger: TestLogger = new TestLogger();
                    let prcaService: PrcaService = new PrcaService(logger, mockGitApi, 'repoId', 15);

                    mockGitApi.configurePRIterations([1, 2]);
                    mockGitApi.configurePrIterationChanges(1, ['file1.cs', 'file2.cs']);
                    mockGitApi.configureException(ErrorTarget.getPullRequestIterations);

                    // Act
                    try {
                        await prcaService.getModifiedFilesInPr();
                        done('Expected getModifiedFilesInPr to have failed');
                    } catch (e) {
                        chai.expect(e.message).to.equal(ConfigurableGitApi.ExpectedExceptionText);
                        done();
                    }
                });

                it('fails if getPullRequestIterationChanges also fails', async (done) => {

                    // Arrange
                    let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
                    let logger: TestLogger = new TestLogger();
                    let prcaService: PrcaService = new PrcaService(logger, mockGitApi, 'repoId', 15);

                    mockGitApi.configurePRIterations([1, 2]);
                    mockGitApi.configurePrIterationChanges(1, ['file1.cs', 'file2.cs']);
                    mockGitApi.configureException(ErrorTarget.getPullRequestIterationChanges);

                    // Act
                    try {
                        await prcaService.getModifiedFilesInPr();
                        done('Expected getModifiedFilesInPr to have failed');
                    } catch (e) {
                        chai.expect(e.message).to.equal(ConfigurableGitApi.ExpectedExceptionText);
                        done();
                    }

                });
            });

            describe('deleteCodeAnalysisComments', () => {
                it('works in conjunction with createCodeAnalysisThreads', mochaAsync(async (done: Function) => {

                    // Arrange
                    let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
                    let logger: TestLogger = new TestLogger();
                    let prcaService: PrcaService = new PrcaService(logger, mockGitApi, 'repoId', 15);

                    mockGitApi.configurePRIterations([1]);
                    let message1 = new Message('bla bla', 'file1.cs', 14, 2);
                    let message2 = new Message('bla bla', 'file1.cs', 14, 2);

                    // Act
                    await prcaService.createCodeAnalysisThreads([message1, message2]);
                    await prcaService.deleteCodeAnalysisComments();

                    // Assert
                    var threads = mockGitApi.ExistingThreads;
                    chai.expect(threads).to.have.length(2);
                    ConfigurableGitApi.validateThreadsAreDeleted(threads);
                }));

                it('does not fail if getPullRequestIterations fails', mochaAsync(async (done: Function) => {

                    // Arrange
                    let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
                    let logger: TestLogger = new TestLogger();
                    let prcaService: PrcaService = new PrcaService(logger, mockGitApi, 'repoId', 15);

                    mockGitApi.configurePRIterations([1]);
                    let message = new Message('bla bla', 'file1.cs', 14, 2);
                    await prcaService.createCodeAnalysisThreads([message]);

                    mockGitApi.configureException(ErrorTarget.getPullRequestIterations);

                    await prcaService.deleteCodeAnalysisComments();

                    // Assert
                    var threads = mockGitApi.ExistingThreads;
                    chai.expect(threads).to.have.length(1);
                    ConfigurableGitApi.validateThreadsAreDeleted(threads);
                }));

                it('fails if deleteComment fails ', (async (done: Function) => {

                    let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
                    let logger: TestLogger = new TestLogger();
                    let prcaService: PrcaService = new PrcaService(logger, mockGitApi, 'repoId', 15);

                    mockGitApi.configurePRIterations([1]);
                    let message = new Message('bla bla', 'file1.cs', 14, 2);
                    await prcaService.createCodeAnalysisThreads([message]);

                    mockGitApi.configureException(ErrorTarget.deleteComment);

                    try {
                        await prcaService.deleteCodeAnalysisComments();
                        done('Expected createCodeAnalysisThreads to have failed');
                    } catch (e) {
                        chai.expect(e.message).to.equal(ConfigurableGitApi.ExpectedExceptionText)
                        done();
                    }
                }));

                it('fails if getThreads fails ', (async (done: Function) => {

                    let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
                    let logger: TestLogger = new TestLogger();
                    let prcaService: PrcaService = new PrcaService(logger, mockGitApi, 'repoId', 15);

                    mockGitApi.configurePRIterations([1]);
                    let message = new Message('bla bla', 'file1.cs', 14, 2);
                    await prcaService.createCodeAnalysisThreads([message]);

                    mockGitApi.configureException(ErrorTarget.getThreads);

                    try {
                        await prcaService.deleteCodeAnalysisComments();
                        done('Expected createCodeAnalysisThreads to have failed');
                    } catch (e) {
                        chai.expect(e.message).to.equal(ConfigurableGitApi.ExpectedExceptionText)
                        done();
                    }
                }));

                it('works with a complex thread setup', mochaAsync(async (done: Function) => {

                    // This is a complex setup taken from a real network capture. The threads look like this:
                    //
                    // 1058 - a system generated thread
                    // 1059-1062 - PRCA threads that were already deleted
                    // 1062 - a PRCA thread with a single comment "Foo"
                    // 1063 - a PRCA thread consisting of 2 comments, "Bar" - posted by PRCA and "User reply" posted by the user
                    // 1064 - a non-PRCA thread with a single comment "User comment"
                    //
                    // Out of these, only 1058 and 1064 should not be deleted because they are not created by PRCA. 1063 will be deleted
                    // even if it has user comments.

                    let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
                    let logger: TestLogger = new TestLogger();
                    let prcaService: PrcaService = new PrcaService(logger, mockGitApi, 'repoId', 15);
                    mockGitApi.configurePRIterations([1]);

                    let serializedThreadsAndCommentsFile = path.join(__dirname, 'data', 'threadsAndComments.json');
                    var data = fs.readFileSync(serializedThreadsAndCommentsFile, 'utf8');
                    var threads = JSON.parse(data);
                    mockGitApi.ExistingThreads = threads.value;

                    await prcaService.deleteCodeAnalysisComments();

                    var threadsThatShouldBeDeleted = mockGitApi.ExistingThreads.filter(t => [1059, 1060, 1061, 1062, 1063].indexOf(t.id) > -1);
                    chai.expect(threadsThatShouldBeDeleted).to.have.length(5, 'Missing threads');
                    ConfigurableGitApi.validateThreadsAreDeleted(threadsThatShouldBeDeleted);

                    ConfigurableGitApi.validateThreadIsNotDeleted(mockGitApi.ExistingThreads.find(t => t.id === 1058));
                    ConfigurableGitApi.validateThreadIsNotDeleted(mockGitApi.ExistingThreads.find(t => t.id === 1064));
                }));
            });

            describe('test with real web calls (warning: run manually)', () => {

                // xit() causes mocha to ignore this test.
                // This test is stored in source control for manual testing only.
                // The collectionUrl, token and repoId vars should be filled in with the appropriate strings.
                xit('Real web calls using token, no assertions!', async (done) => {

                    // for Fiddler to capture the traffic it needs to go through a proxy
                    // process.env.https_proxy = 'http://127.0.0.1:8888';
                    // process.env.http_proxy = 'http://127.0.0.1:8888';
                    // process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

                    var collectionUrl = ''; // DO NOT COMMIT THE COLLECTION
                    let token: string = '';  // DO NOT COMMIT THE PAT
                    let creds = web.getPersonalAccessTokenHandler(token);

                    var repoId = '';
                    var prId = 113;

                    var connection = new WebApi(collectionUrl, creds);
                    let vstsGit: IGitApi = connection.getGitApi();

                    let logger: TestLogger = new TestLogger();
                    let prcaService: PrcaService = new PrcaService(logger, vstsGit, repoId, prId);
                    try {
                        await prcaService.createCodeAnalysisThreads([new Message('Foo', '/Extractor/Program.cs', 1, 5)]);
                        await prcaService.createCodeAnalysisThreads([new Message('Bar', '/ConsoleApplication1/App.config', 3, 1)]);

                        done();
                    } catch (e) {
                        done(e);
                    }

                });
            });
        });
    });

    describe('task', () => {

        it('succeeds but skips on a non-PR build', (done:MochaDone) => {
            this.timeout(1000);

            let tp: string = path.join(__dirname, 'L0skipsNotPr.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            tr.run();
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');

            done();
        });

        it('fails if the SonarQube report location is not available', (done:MochaDone) => {
            this.timeout(1000);

            let tp: string = path.join(__dirname, 'L0failsWithoutReportLocation.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            tr.run();
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.failed, 'task should have failed');
            AssertMessageInStdout(tr.stdout, 'Make sure a SonarQube-enabled build task ran before this step.');

            done();
        });

        it('fails correctly when a connection cannot be made to the server', (done:MochaDone) => {
            // NB: This is not an integration test.
            // Therefore, we expect a failure when the API calls against a non-existent VSTS server.

            this.timeout(1000);

            let tp: string = path.join(__dirname, 'L0runsWithReportLocation.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            tr.run();
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.failed, 'task should have failed');
            AssertMessageInStdout(tr.stdout, 'Failed to get the files modified by the pull request.');
            AssertMessageInStdout(tr.stdout, 'Task failed with the following error: loc_mock_Info_ResultFail_FailedToGetModifiedFiles');

            done();
        });

    })
});