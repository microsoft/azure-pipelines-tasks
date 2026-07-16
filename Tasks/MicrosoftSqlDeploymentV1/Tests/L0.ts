import * as assert from 'assert';
import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import SqlConnectionConfig from '../src/SqlConnectionConfig';

describe('MicrosoftSqlDeployment Suite', function () {
    this.timeout(60000);

    function runValidations(validator: () => void, tr: ttm.MockTestRunner) {
        try {
            validator();
        } catch (error) {
            console.log('STDERR', tr.stderr);
            console.log('STDOUT', tr.stdout);
            throw error;
        }
    }

    before(() => {
        process.env['SYSTEM_DEBUG'] = 'true';
    });

    after(() => {
        // Cleanup
    });

    // ============================================
    // SqlConnectionConfig Unit Tests
    // ============================================
    
    describe('SqlConnectionConfig - Valid connection strings', function() {
        const validConnectionStrings: [string, string, string][] = [
            [`Server=test1.database.windows.net;User Id=user;Password="placeholder'=placeholder''c;123";Initial catalog=testdb`, `placeholder'=placeholder''c;123`, 'validates values enclosed with double quotes'],
            [`Server=test1.database.windows.net;User Id=user;Password='placeholder;1""2"placeholder=33';Initial catalog=testdb`, `placeholder;1""2"placeholder=33`, 'validates values enclosed with single quotes'],
            [`Server=test1.database.windows.net;User Id=user;Password="placeholder;1""2""placeholder(012j^72''placeholder;')'=33";Initial catalog=testdb`, `placeholder;1"2"placeholder(012j^72''placeholder;')'=33`, 'validates values with escaped double quotes'],
            [`Server=test1.database.windows.net;User Id=user;Password='placeholder""c;1''2''"''placeholder("0""12j^72''placeholder;'')''=33';Initial catalog=testdb`, `placeholder""c;1'2'"'placeholder("0""12j^72'placeholder;')'=33`, 'validates values with escaped single quotes'],
            [`Server=test1.database.windows.net;User Id=user;Password=placeholder;Initial catalog=testdb`, `placeholder`, 'validates unquoted values'],
            [`Server=test1.database.windows.net;Database=testdb;User Id=user;Password=placeholder;Authentication=SQL Password`, `placeholder`, 'validates SQL password authentication'],
            [`Server=test1.database.windows.net;Database=testdb;User Id=user;Password=placeholder;Authentication=SQLPassword`, `placeholder`, 'validates SQL password authentication one word'],
            [`Server=test1.database.windows.net;Database=testdb;User Id=user;Password=placeholder;Authentication='SQL Password'`, `placeholder`, 'validates SQL password authentication with quotes'],
        ];

        validConnectionStrings.forEach(([connectionString, expectedPassword, description]) => {
            it(description, function() {
                const config = new SqlConnectionConfig(connectionString);
                
                assert.strictEqual(config.Password, expectedPassword, 'password should match');
                assert.strictEqual(config.UserId, 'user', 'user id should match');
                assert.strictEqual(config.Database, 'testdb', 'database should match');
                assert.strictEqual(config.Server, 'test1.database.windows.net', 'server should match');
            });
        });
    });

    describe('SqlConnectionConfig - Invalid connection strings', function() {
        const invalidConnectionStrings: [string, string, string][] = [
            [`Server=test1.database.windows.net;User Id=user;Password="placeholder'=placeholder''c;123;Initial catalog=testdb`, `InvalidConnectionString`, 'unmatched double quote'],
            [`Server=test1.database.windows.net;User Id=user;Password='placeholder;1""2"placeholder=33;Initial catalog=testdb`, `InvalidConnectionString`, 'unmatched single quote'],
            [`Server=test1.database.windows.net;User Id=user;Password="placeholder;1""2"placeholder=33";Initial catalog=testdb`, `InvalidConnectionString`, 'unescaped double quotes inside value'],
            [`Server=test1.database.windows.net;User Id=user;Password='placeholder;1'2''placeholder';Initial catalog=testdb`, `InvalidConnectionString`, 'unescaped single quotes inside value'],
            [`Server=test1.database.windows.net;User Id=user;Password=placeholder@;#$placeholder;Initial catalog=testdb`, `InvalidConnectionString`, 'unquoted value with semicolon'],
            [`Server=test1.database.windows.net;Password=placeholder;Initial catalog=testdb`, `ConnectionStringMissingUserId`, 'missing user id'],
            [`Server=test1.database.windows.net;User Id=user;Initial catalog=testdb`, `ConnectionStringMissingPassword`, 'missing password'],
            [`User Id=user;Password=password`, `ConnectionStringMissingServer`, 'missing server'],
            [`Server=test1.database.windows.net;User Id=user;Password=password;`, `ConnectionStringMissingDatabase`, 'missing database'],
            [`Server=test1.database.windows.net;Database=testdb;Authentication='Active Directory Password';Password=password;`, `ConnectionStringMissingUserId`, 'AAD password auth missing user'],
            [`Server=test1.database.windows.net;Database=testdb;Authentication='Active Directory Password';User Id=user;`, `ConnectionStringMissingPassword`, 'AAD password auth missing password'],
            [`Server=test1.database.windows.net;Database=testdb;Authentication='SQL Password';Password=password;`, `ConnectionStringMissingUserId`, 'SQL password auth missing user'],
            [`Server=test1.database.windows.net;Database=testdb;Authentication='SQL Password';User Id=user;`, `ConnectionStringMissingPassword`, 'SQL password auth missing password'],
            [`Server=test1.database.windows.net;Database=testdb;Authentication='ActiveDirectoryServicePrincipal';Password=placeholder;`, `ConnectionStringMissingClientId`, 'Service principal auth without client ID'],
            [`Server=test1.database.windows.net;Database=testdb;Authentication='ActiveDirectoryServicePrincipal';User Id=clientId;`, `ConnectionStringMissingClientSecret`, 'Service principal auth without client secret']
        ];

        invalidConnectionStrings.forEach(([connectionString, expectedError, description]) => {
            it(`should throw for ${description}`, function() {
                assert.throws(() => {
                    new SqlConnectionConfig(connectionString);
                }, new RegExp(expectedError));
            });
        });
    });

    describe('SqlConnectionConfig - Authentication parsing', function() {
        const authenticationStrings: [string, string | undefined, string][] = [
            [`Server=test1.database.windows.net;Database=testdb;User Id=user;Password="placeholder";`, undefined, 'no authentication set'],
            [`Server=test1.database.windows.net;Database=testdb;Authentication="Sql Password";User Id=user;Password="placeholder";`, 'sqlpassword', 'SQL password with double quotes'],
            [`Server=test1.database.windows.net;Database=testdb;Authentication=Sql Password;User Id=user;Password="placeholder";`, 'sqlpassword', 'SQL password with no quotes'],
            [`Server=test1.database.windows.net;Database=testdb;Authentication='SqlPassword';User Id=user;Password="placeholder";`, 'sqlpassword', 'SQL password one word'],
            [`Server=test1.database.windows.net;Database=testdb;Authentication="Active Directory Password";User Id=user;Password="placeholder";`, 'activedirectorypassword', 'AAD password with double quotes'],
            [`Server=test1.database.windows.net;Database=testdb;Authentication=Active Directory Password;User Id=user;Password="placeholder";`, 'activedirectorypassword', 'AAD password with no quotes'],
            [`Server=test1.database.windows.net;Database=testdb;Authentication='ActiveDirectoryPassword';User Id=user;Password="placeholder";`, 'activedirectorypassword', 'AAD password one word'],
            [`Server=test1.database.windows.net;Database=testdb;Authentication="Active Directory Service Principal";User Id=user;Password="placeholder";`, 'activedirectoryserviceprincipal', 'AAD service principal with double quotes'],
            [`Server=test1.database.windows.net;Database=testdb;Authentication=Active Directory Service Principal;User Id=user;Password="placeholder";`, 'activedirectoryserviceprincipal', 'AAD service principal with no quotes'],
            [`Server=test1.database.windows.net;Database=testdb;Authentication='ActiveDirectoryServicePrincipal';User Id=user;Password="placeholder";`, 'activedirectoryserviceprincipal', 'AAD service principal one word'],
            [`Server=test1.database.windows.net;Database=testdb;Authentication="Active Directory Default"`, 'activedirectorydefault', 'AAD default with double quotes'],
            [`Server=test1.database.windows.net;Database=testdb;Authentication=Active Directory Default`, 'activedirectorydefault', 'AAD default with no quotes'],
            [`Server=test1.database.windows.net;Database=testdb;Authentication='ActiveDirectoryDefault'`, 'activedirectorydefault', 'AAD default one word'],
            [`Server=test1.database.windows.net;Database=testdb;Authentication="Active Directory Integrated"`, 'activedirectoryintegrated', 'AAD integrated with double quotes'],
            [`Server=test1.database.windows.net;Database=testdb;Authentication=Active Directory Integrated`, 'activedirectoryintegrated', 'AAD integrated with no quotes'],
            [`Server=test1.database.windows.net;Database=testdb;Authentication='ActiveDirectoryIntegrated'`, 'activedirectoryintegrated', 'AAD integrated one word'],
        ];

        authenticationStrings.forEach(([connectionString, expectedAuthType, description]) => {
            it(`should parse ${description}`, function() {
                const config = new SqlConnectionConfig(connectionString);
                
                assert.strictEqual(config.Server, 'test1.database.windows.net', 'server should match');
                assert.strictEqual(config.Database, 'testdb', 'database should match');
                assert.strictEqual(config.FormattedAuthentication, expectedAuthType, 'authentication type should match');
                
                // Validate credentials based on auth type
                switch (expectedAuthType) {
                    case undefined:
                    case 'sqlpassword':
                    case 'activedirectorypassword':
                    case 'activedirectoryserviceprincipal':
                        assert.strictEqual(config.UserId, 'user', 'user id should be present');
                        assert.strictEqual(config.Password, 'placeholder', 'password should be present');
                        break;
                    case 'activedirectorydefault':
                    case 'activedirectoryintegrated':
                        // No credentials required
                        break;
                }
            });
        });
    });

    describe('SqlConnectionConfig - Server name parsing', function() {
        const serverNameStrings: [string, string, number | undefined, string][] = [
            [`Server=test1.database.windows.net;Database=testdb;User Id=user;Password=placeholder;Authentication=SQLPassword`, 'test1.database.windows.net', undefined, 'server name without prefix or port'],
            [`Server=tcp:test1.database.windows.net;Database=testdb;User Id=user;Password=placeholder;Authentication=SQLPassword`, 'test1.database.windows.net', undefined, 'server name with tcp prefix'],
            [`Server=tcp:test1.database.windows.net,1433;Database=testdb;User Id=user;Password=placeholder;Authentication=SQLPassword`, 'test1.database.windows.net', 1433, 'server name with tcp prefix and port'],
            [`Server=database.windows.net,1433;Database=testdb;User Id=user;Password=placeholder;Authentication=SQLPassword`, 'database.windows.net', 1433, 'server name with port'],
            [`Server=test2.20ee0ae768cc.database.windows.net,3342;Database=testdb;User Id=user;Password=placeholder;Authentication=SQLPassword`, 'test2.20ee0ae768cc.database.windows.net', 3342, 'server name with custom port'],
            [`Data Source=myserver\\SQLEXPRESS;Database=testdb;User Id=user;Password=placeholder;`, 'myserver\\SQLEXPRESS', undefined, 'named instance with backslash'],
        ];

        serverNameStrings.forEach(([connectionString, expectedServer, expectedPort, description]) => {
            it(`should parse ${description}`, function() {
                const config = new SqlConnectionConfig(connectionString);
                
                assert.strictEqual(config.Server, expectedServer, 'server should match');
                assert.strictEqual(config.Port, expectedPort, 'port should match');
                assert.strictEqual(config.Database, 'testdb', 'database should match');
            });
        });
    });

    describe('SqlConnectionConfig - EscapedConnectionString', function() {
        it('should double-escape double quotes in quoted values', function() {
            const connectionString = `Server=test.database.windows.net;Database=testdb;User Id=user;Password="my""pass"`;
            const config = new SqlConnectionConfig(connectionString);
            
            const escaped = config.EscapedConnectionString;
            assert.ok(escaped.includes('Password=""my""pass""'), 'should double-escape quotes');
        });

        it('should preserve single-quoted values as-is', function() {
            const connectionString = `Server=test.database.windows.net;Database=testdb;User Id=user;Password='my''pass'`;
            const config = new SqlConnectionConfig(connectionString);
            
            const escaped = config.EscapedConnectionString;
            assert.ok(escaped.includes("Password='my''pass'"), 'should preserve single quotes');
        });

        it('should preserve unquoted values', function() {
            const connectionString = `Server=test.database.windows.net;Database=testdb;User Id=user;Password=mypass`;
            const config = new SqlConnectionConfig(connectionString);
            
            const escaped = config.EscapedConnectionString;
            assert.ok(escaped.includes('Password=mypass'), 'should preserve unquoted values');
        });
    });

    describe('SqlConnectionConfig - Keyword aliases', function() {
        it('should parse "Data Source" as server', function() {
            const config = new SqlConnectionConfig('Data Source=myserver;Database=testdb;User Id=user;Password=pass');
            assert.strictEqual(config.Server, 'myserver');
        });

        it('should parse "Initial Catalog" as database', function() {
            const config = new SqlConnectionConfig('Server=myserver;Initial Catalog=testdb;User Id=user;Password=pass');
            assert.strictEqual(config.Database, 'testdb');
        });

        it('should parse "User" as user id', function() {
            const config = new SqlConnectionConfig('Server=myserver;Database=testdb;User=myuser;Password=pass');
            assert.strictEqual(config.UserId, 'myuser');
        });
    });

    // ============================================
    // Task Integration Tests
    // ============================================

    it('should fail if action input is not provided', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0MissingAction.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.failed, 'task should have failed when action is not provided');
            assert(tr.invokedToolCount === 0, 'should not have invoked any tool');
            assert(tr.errorIssues.length > 0, 'should have error issues');
        }, tr);
    });

    it('should fail if path input is not provided', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0MissingPath.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.failed, 'task should have failed when path is not provided');
            assert(tr.invokedToolCount === 0, 'should not have invoked any tool');
            assert(tr.errorIssues.length > 0, 'should have error issues');
        }, tr);
    });

    it('should fail if connectionString input is not provided', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0MissingConnectionString.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.failed, 'task should have failed when connectionString is not provided');
            assert(tr.invokedToolCount === 0, 'should not have invoked any tool');
            assert(tr.errorIssues.length > 0, 'should have error issues');
        }, tr);
    });

    it('should fail when path does not exist', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0PathDoesNotExist.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.failed, 'task should have failed when file path does not exist');
            assert(tr.invokedToolCount === 0, 'should not have invoked any tool');
            assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have error about missing path');
        }, tr);
    });

    it('should fail when path is a directory', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0PathIsDirectory.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.failed, 'task should have failed when path is a directory');
            assert(tr.invokedToolCount === 0, 'should not have invoked any tool');
            assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have error about invalid path');
        }, tr);
    });

    it('should fail on invalid file extension', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0InvalidFileExtension.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.failed, 'task should have failed with invalid file extension');
            assert(tr.invokedToolCount === 0, 'should not have invoked any tool');
            assert(tr.stdout.indexOf('InvalidFileExtension') >= 0, 'should display invalid file extension error');
        }, tr);
    });

    it('should fail when firewallRuleManagement is true but azureSubscription is not provided', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0FirewallWithoutAzureSubscription.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.failed, 'task should have failed when firewall requires azure subscription');
            assert(tr.invokedToolCount === 0, 'should not have invoked any tool');
            assert(tr.stdout.indexOf('FirewallManagementRequiresAzureSubscription') >= 0, 'should display firewall requires azure subscription error');
        }, tr);
    });

    it('should fail when dotnet SDK is not found', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'Mocks', 'L0SqlProjectDotnetNotFound.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.failed, 'task should fail when dotnet SDK is not found');
            assert(tr.stdout.indexOf('DotnetNotFound') >= 0 || tr.errorIssues.some(e => e.includes('.NET SDK not found')), 
                'should display dotnet not found error');
        }, tr);
    });

    // Integration tests for SqlPackage/sqlcmd execution
    it('should succeed with valid dacpac inputs', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0ValidDacpacInputs.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.succeeded, 'task should have succeeded with valid dacpac inputs');
        }, tr);
    });

    it('should succeed with valid sql script inputs', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0ValidSqlScriptInputs.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.succeeded, 'task should have succeeded with valid sql script inputs');
        }, tr);
    });

    it('should succeed with valid sqlproj inputs', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0ValidSqlProjInputs.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.succeeded, 'task should have succeeded with valid sqlproj inputs');
        }, tr);
    });

    it('should fail when SqlPackage is not found', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0SqlPackageNotFound.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.failed, 'task should have failed when SqlPackage is not found');
        }, tr);
    });

    it('should succeed when SqlPackage is found via user-provided path', async () => {
        this.timeout(5000);

        const tp = path.join(__dirname, 'L0SqlPackageFromUserPath.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed when SqlPackage is found via user path');
        }, tr);
    });
});
