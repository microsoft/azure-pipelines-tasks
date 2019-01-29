import ttm = require("vsts-task-lib/mock-test");
import fs = require("fs");
import path = require("path");
import assert = require("assert");
import kusto = require("../src/kusto");

describe('Test Kusto module', function () {
    it('should split scripts with multiple commands', () => {
        var text = fs.readFileSync(path.join(__dirname, "test0.csl"), { encoding: "utf-8" });
        assert.equal(kusto.getCommands(text, /*singleCommand*/false).length, 2);
    });

    it('should split scripts with a single command', () => {
        var text = fs.readFileSync(path.join(__dirname, "test1.csl"), { encoding: "utf-8" });
        assert.equal(kusto.getCommands(text, /*singleCommand*/false).length, 1);
    });

    it('should split scripts with single command containing empty lines', () => {
        var text = fs.readFileSync(path.join(__dirname, "test2.csl"), { encoding: "utf-8" });
        var commands = kusto.getCommands(text, /*singleCommand*/true);
        assert.equal(commands.length, 1);
        assert.equal(commands[0][0], '.', 'Kusto commands must start with a dot. Invalid command: ' + commands[0]);
    });

    it('should handle curly brackets in strings (with \'with\' statement)', () => {
        var text = fs.readFileSync(path.join(__dirname, "test3.csl"), { encoding: "utf-8" });

        var commands = kusto.getCommands(text, /*singleCommand*/true);
        assert.equal(commands.length, 1);

        var command = kusto.insertFunctionValidationSkipping(commands[0]);

        assert.equal(command.split('\n').length, 44, 'Curly brackets in the middle of a function must not end function parsing. Invalid command: ' + command);
    });

    it('should handle curly brackets in strings (without \'with\' statement)', () => {
        var text = fs.readFileSync(path.join(__dirname, "test4.csl"), { encoding: "utf-8" });

        var commands = kusto.getCommands(text, /*singleCommand*/true);
        assert.equal(commands.length, 1);

        var command = kusto.insertFunctionValidationSkipping(commands[0]);

        assert.equal(command.split('\n').length, 44, 'Curly brackets in the middle of a function must not end function parsing. Invalid command: ' + command);
    });

    it('should handle function comments with parentheses in them', () => {
        var text = fs.readFileSync(path.join(__dirname, "test5.csl"), { encoding: "utf-8" });

        var commands = kusto.getCommands(text, /*singleCommand*/true);
        assert.equal(commands.length, 1);

        var command = kusto.insertFunctionValidationSkipping(commands[0]);

        assert.equal(command.split('\r\n')[0], '.create-or-alter function with (skipvalidation=\'true\', folder = @\'ssr\\cleanedevents\', docstring = \'processing_EventTransactionSummary(runDate:string) - used populate the table event_Commerce_TransactionLine\') {');
    });

    it('should execute commands', async () => {
        await kusto.executeCommand("cluster.kusto.windows.net", "database", "command", "accessToken");
    });
    
    it('should parse Kusto endpoint URLs', () => {
        assert.equal(kusto.splitEndpointUrls("https://cluster.kusto.windows.net:443?DatabaseName=database").length, 1);
        assert.equal(kusto.splitEndpointUrls("https://Cluster.kusto.windows.net:443?DatabaseName=Database")[0].cluster, "Cluster.kusto.windows.net");
        assert.equal(kusto.splitEndpointUrls("https://Cluster.kusto.windows.net:443?DatabaseName=Database")[0].database, "Database");
        assert.equal(kusto.splitEndpointUrls("HTTPS://CLUSTER.KUSTO.WINDOWS.NET?DATABASENAME=DATABASE").length, 1);
        assert.equal(kusto.splitEndpointUrls("https://cluster.kusto.windows.net:443?DatabaseName=database;https://123.kusto.windows.net:443?DatabaseName=456").length, 2);
        assert.equal(kusto.splitEndpointUrls("https://cluster.kusto.windows.net:443?DatabaseName=database;https://123.kusto.windows.net:443?DatabaseName=456")[0].cluster, "cluster.kusto.windows.net");
        assert.equal(kusto.splitEndpointUrls("https://cluster.kusto.windows.net:443?DatabaseName=database;https://123.kusto.windows.net:443?DatabaseName=456")[0].database, "database");
    });

    it('should skip function validation', () => {

        assert.equal(
            kusto.insertFunctionValidationSkipping(".set-or-replace Test00 <| print 1"),
            ".set-or-replace Test00 <| print 1");

        assert.equal(
            kusto.insertFunctionValidationSkipping(".create table MyLogs (Level:string)"),
            ".create table MyLogs (Level:string)");

        assert.equal(
            kusto.insertFunctionValidationSkipping(".create function with (skipvalidation='false') Test01 { 1 }"),
            ".create function with (skipvalidation='false') Test01 { 1 }");

        assert.equal(
            kusto.insertFunctionValidationSkipping(".create function with (skipvalidation='true') Test02 { 1 }"),
            ".create function with (skipvalidation='true') Test02 { 1 }");

        assert.equal(
            kusto.insertFunctionValidationSkipping(".create function with (docstring='help', skipvalidation='false', folder='folder) Test03 { 1 }"),
            ".create function with (docstring='help', skipvalidation='false', folder='folder) Test03 { 1 }");

        assert.equal(
            kusto.insertFunctionValidationSkipping(".create function with (docstring='help', folder='folder) Test04 { 1 }"),
            ".create function with (skipvalidation='true', docstring='help', folder='folder) Test04 { 1 }");

        assert.equal(
            kusto.insertFunctionValidationSkipping(".create-or-alter function with (docstring='help', folder='folder) Test04a { 1 }"),
            ".create-or-alter function with (skipvalidation='true', docstring='help', folder='folder) Test04a { 1 }");

        assert.equal(
            kusto.insertFunctionValidationSkipping(".create function with (docstring='help') Test05 { 1 }"),
            ".create function with (skipvalidation='true', docstring='help') Test05 { 1 }");

        assert.equal(
            kusto.insertFunctionValidationSkipping(".create function with () Test06 { 1 }"),
            ".create function with (skipvalidation='true') Test06 { 1 }");

        assert.equal(
            kusto.insertFunctionValidationSkipping(".create function with (skipvalidation='true', docstring='help') Test07 { 1 }"),
            ".create function with (skipvalidation='true', docstring='help') Test07 { 1 }");

        assert.equal(
            kusto.insertFunctionValidationSkipping(".create function ifnotexists Test08 { 1 }"),
            ".create function ifnotexists with (skipvalidation='true') Test08 { 1 }");

        assert.equal(
            kusto.insertFunctionValidationSkipping(".create function Test08a { 1 }"),
            ".create function with (skipvalidation='true') Test08a { 1 }");

        assert.equal(
            kusto.insertFunctionValidationSkipping(".create function Test09() { 1 }"),
            ".create function with (skipvalidation='true') Test09() { 1 }");

        assert.equal(
            kusto.insertFunctionValidationSkipping(".create function Test10(){1}"),
            ".create function with (skipvalidation='true') Test10(){1}");

        assert.equal(
            kusto.insertFunctionValidationSkipping(".create function Test11   (){1}"),
            ".create function with (skipvalidation='true') Test11   (){1}");

        assert.equal(
            kusto.insertFunctionValidationSkipping(".alter function Test12 { 1 }"),
            ".alter function with (skipvalidation='true') Test12 { 1 }");

        assert.equal(
            kusto.insertFunctionValidationSkipping(".alter    function   Test13   { 1 }"),
            ".alter    function   with (skipvalidation='true') Test13   { 1 }");

        assert.equal(
            kusto.insertFunctionValidationSkipping(".alter function Test14{1}"),
            ".alter function with (skipvalidation='true') Test14{1}");

        assert.equal(
            kusto.insertFunctionValidationSkipping(".create-or-alter function Test15 { 1 }"),
            ".create-or-alter function with (skipvalidation='true') Test15 { 1 }");

        assert.equal(
            kusto.insertFunctionValidationSkipping(`// A comment
.create-or-alter function Test16
(Level:string,
Name:string) { 1 }`),
            `// A comment
.create-or-alter function with (skipvalidation='true') Test16
(Level:string,
Name:string) { 1 }`);

        assert.equal(
            kusto.insertFunctionValidationSkipping(`.create function 
with (skipvalidation='false') Test01
{
    1
}`),
            `.create function 
with (skipvalidation='false') Test01
{
    1
}`);
    });
});
