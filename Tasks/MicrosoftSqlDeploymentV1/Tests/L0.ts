import * as assert from 'assert';
import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import SqlConnectionConfig from '../src/SqlConnectionConfig';

describe('MicrosoftSqlDeployment Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

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
            [`Server=test1.database.windows.net;Database=testdb;Authentication='ActiveDirectoryServicePrincipal';User Id=clientId;`, `ConnectionStringMissingClientSecret`, 'Service principal auth without client secret'],
            [`Server=test1.database.windows.net;Database=testdb;Integrated Security=true;`, `UnsupportedAuthentication`, 'Windows Integrated Security not supported'],
            [`Server=test1.database.windows.net;Database=testdb;Trusted_Connection=yes;`, `UnsupportedAuthentication`, 'Trusted_Connection not supported'],
            [`Server=test1.database.windows.net;Database=testdb;Authentication='ActiveDirectoryMSI';`, `UnsupportedAuthentication`, 'unknown Authentication keyword rejected']
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

    describe('SqlConnectionConfig - ConnectionString', function() {
        it('should preserve double-quoted values without re-escaping them', function() {
            const connectionString = `Server=test.database.windows.net;Database=testdb;User Id=user;Password="my""pass"`;
            const config = new SqlConnectionConfig(connectionString);

            // The value parses as my"pass, so the connection string must be handed to
            // SqlPackage untouched. Doubling the outer quotes would change the password.
            assert.strictEqual(config.Password, 'my"pass', 'should parse the escaped password');
            assert.strictEqual(config.ConnectionString, connectionString, 'should not modify the connection string');
        });

        it('should preserve single-quoted values as-is', function() {
            const connectionString = `Server=test.database.windows.net;Database=testdb;User Id=user;Password='my''pass'`;
            const config = new SqlConnectionConfig(connectionString);

            assert.strictEqual(config.Password, "my'pass", 'should parse the escaped password');
            assert.strictEqual(config.ConnectionString, connectionString, 'should not modify the connection string');
        });

        it('should preserve unquoted values', function() {
            const connectionString = `Server=test.database.windows.net;Database=testdb;User Id=user;Password=mypass`;
            const config = new SqlConnectionConfig(connectionString);

            assert.strictEqual(config.ConnectionString, connectionString, 'should not modify the connection string');
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
        const tp = path.join(__dirname, 'L0MissingConnectionString.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.failed, 'task should have failed when connectionString is not provided');
            assert(tr.invokedToolCount === 0, 'should not have invoked any tool');
            assert(tr.errorIssues.length > 0, 'should have error issues');
        }, tr);
    });

    it('should fail on invalid file extension', async () => {
        const tp = path.join(__dirname, 'L0InvalidFileExtension.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.failed, 'task should have failed with invalid file extension');
            assert(tr.invokedToolCount === 0, 'should not have invoked any tool');
            assert(tr.stdout.indexOf('InvalidFileExtension') >= 0, 'should display invalid file extension error');
        }, tr);
    });

    it('should accept an action whose casing differs from the pickList', async () => {
        const tp = path.join(__dirname, 'L0ActionCasingInsensitive.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.succeeded, 'task should have succeeded with action "SqlScript"');
            assert(tr.invokedToolCount === 1, 'should have invoked sqlcmd once');
        }, tr);
    });

    it('should reject a SqlPackage action for a .sql file before tool discovery', async () => {
        const tp = path.join(__dirname, 'L0InvalidActionForSqlFile.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.failed, 'task should have failed for action "script" with a .sql file');
            assert(tr.invokedToolCount === 0, 'should not have invoked any tool');
            assert(tr.stdout.indexOf('InvalidAction') >= 0, 'should display the invalid action error');
        }, tr);
    });

    it('should reject sqlScript for a .dacpac file before tool discovery', async () => {
        const tp = path.join(__dirname, 'L0InvalidActionForDacpac.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.failed, 'task should have failed for action "sqlScript" with a .dacpac file');
            assert(tr.invokedToolCount === 0, 'should not have invoked any tool');
            assert(tr.stdout.indexOf('InvalidAction') >= 0, 'should display the invalid action error');
        }, tr);
    });

    it('should fail when path does not exist', async () => {
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
        const tp = path.join(__dirname, 'L0PathIsDirectory.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.failed, 'task should have failed when path is a directory');
            assert(tr.invokedToolCount === 0, 'should not have invoked any tool');
            assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have error about invalid path');
        }, tr);
    });

    it('should fail when dotnet SDK is not found', async () => {
        const tp = path.join(__dirname, 'Mocks', 'L0SqlProjectDotnetNotFound.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.failed, 'task should fail when dotnet SDK is not found');
            assert(tr.stdout.indexOf('DotnetNotFound') >= 0 || tr.errorIssues.some(e => e.includes('.NET SDK not found')),
                'should display dotnet not found error');
        }, tr);
    });

    it('should fail when firewallRuleManagement is true but azureSubscription is not provided', async () => {
        const tp = path.join(__dirname, 'L0FirewallWithoutAzureSubscription.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        await tr.runAsync();
        
        runValidations(() => {
            assert(tr.failed, 'task should have failed when firewall requires azure subscription');
            assert(tr.invokedToolCount === 0, 'should not have invoked any tool');
            assert(tr.stdout.indexOf('FirewallManagementRequiresAzureSubscription') >= 0, 'should display firewall requires azure subscription error');
        }, tr);
    });

    it('should succeed when SqlPackage is found via DacFramework MSI', async function() {
        if (process.platform !== 'win32') {
            this.skip();
            return;
        }
        const tp = path.join(__dirname, 'L0SqlPackageFromDacFramework.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed when SqlPackage is found via DacFramework MSI');
            assert(tr.stdout.indexOf('DacFramework') >= 0 || tr.stdout.indexOf('170') >= 0 || tr.stdout.indexOf('SqlPackageFound') >= 0,
                'should report SqlPackage found at DacFramework location');
        }, tr);
    });

    it('should succeed when sqlcmd is auto-installed', async () => {
        const tp = path.join(__dirname, 'L0SqlcmdAutoInstallSuccess.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed when sqlcmd is auto-installed');
            assert(tr.stdout.indexOf('SqlCmdInstalled') >= 0 || tr.stdout.indexOf('sqlcmd-extracted') >= 0,
                'should report sqlcmd installed successfully');
        }, tr);
    });

    it('should auto-install go-sqlcmd when ODBC sqlcmd is on PATH', async () => {
        // Verifies that isGoSqlcmd() correctly rejects ODBC sqlcmd (--version output
        // does not match "sqlcmd version X.X.X") and falls through to auto-install.
        const tp = path.join(__dirname, 'L0SqlcmdOdbcOnPathFallsToAutoInstall.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed after auto-installing go-sqlcmd');
            assert(tr.stdout.indexOf('SqlCmdInstalling') >= 0 || tr.stdout.indexOf('sqlcmd-extracted') >= 0,
                'should have triggered auto-install when ODBC sqlcmd was on PATH');
        }, tr);
    });

    it('should fail when sqlcmd executable is missing after auto-install extraction', async () => {
        const tp = path.join(__dirname, 'L0SqlcmdAutoInstallExeNotFound.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.failed, 'task should fail when executable is missing after extraction');
            assert(tr.stdout.indexOf('SqlcmdAutoInstallFailed') >= 0 || tr.errorIssues.some(e => e.includes('not found after extraction') || e.includes('SqlcmdExecutableNotFoundAfterExtract')),
                'should report executable not found after extraction');
        }, tr);
    });

    it('should fail when SqlPackage is not found anywhere', async () => {
        const tp = path.join(__dirname, 'L0SqlPackageNotFound.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.failed, 'task should fail when SqlPackage is not found');
            assert(tr.stdout.indexOf('SqlPackageNotFound') >= 0 || tr.errorIssues.some(e => e.includes('SqlPackage not found')),
                'should display SqlPackage not found error');
        }, tr);
    });

    it('should succeed when SqlPackage is found via user-provided path', async () => {
        const tp = path.join(__dirname, 'L0SqlPackageFromUserPath.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed when SqlPackage is found via user path');
            assert(tr.stdout.indexOf('SqlPackageFound') >= 0 || tr.stdout.indexOf('custom/sqlpackage') >= 0,
                'should report SqlPackage found at user-provided path');
        }, tr);
    });

    it('should succeed when SqlPackage is found via dotnet tool', async () => {
        const tp = path.join(__dirname, 'L0SqlPackageFromDotnetTool.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed when SqlPackage is found via dotnet tool');
            assert(tr.stdout.indexOf('SqlPackageFound') >= 0 || tr.stdout.indexOf('.dotnet') >= 0,
                'should report SqlPackage found at dotnet tool location');
        }, tr);
    });

    it('should fail when user-provided SqlPackage path does not exist', async () => {
        const tp = path.join(__dirname, 'L0SqlPackageUserPathNotFound.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.failed, 'task should fail when user-provided SqlPackage path does not exist');
            assert(tr.stdout.indexOf('SqlPackageNotFoundAtPath') >= 0 || tr.errorIssues.some(e => e.includes('not found at specified path')),
                'should display SqlPackage not found at path error');
        }, tr);
    });

    it('should fail when user-provided sqlcmd path does not exist', async () => {
        const tp = path.join(__dirname, 'L0SqlcmdUserPathNotFound.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.failed, 'task should fail when user-provided sqlcmd path does not exist');
            assert(tr.stdout.indexOf('SqlcmdNotFoundAtPath') >= 0 || tr.errorIssues.some(e => e.includes('sqlcmd not found at specified path')),
                'should display sqlcmd not found at path error');
        }, tr);
    });

    it('should succeed when sqlcmd is found via user-provided path', async () => {
        const tp = path.join(__dirname, 'L0SqlcmdFromUserPath.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed when sqlcmd is found via user path');
            assert(tr.stdout.indexOf('SqlCmdFound') >= 0 || tr.stdout.indexOf('custom/path/sqlcmd') >= 0,
                'should report sqlcmd found at user-provided path');
        }, tr);
    });

    it('should succeed when sqlcmd is found on PATH', async () => {
        const tp = path.join(__dirname, 'L0SqlcmdFromPath.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed when sqlcmd is found on PATH');
            assert(tr.stdout.indexOf('SqlCmdFound') >= 0 || tr.stdout.indexOf('/usr/bin/sqlcmd') >= 0,
                'should report sqlcmd found on PATH');
        }, tr);
    });

    it('should succeed with valid dacpac inputs', async () => {
        const tp = path.join(__dirname, 'L0ValidDacpacInputs.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed with valid dacpac inputs');
            assert(tr.stdout.indexOf('ActionDetected') >= 0, 'should detect action and file type');
            assert(tr.stdout.indexOf('DACPAC') >= 0, 'should detect DACPAC file type');
        }, tr);
    });

    it('should succeed with valid sql script inputs', async () => {
        const tp = path.join(__dirname, 'L0ValidSqlScriptInputs.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed with valid sql script inputs');
            assert(tr.stdout.indexOf('ActionDetected') >= 0, 'should detect action and file type');
            assert(tr.stdout.indexOf('SQL') >= 0, 'should detect SQL file type');
        }, tr);
    });

    it('should succeed with valid sqlproj inputs', async () => {
        const tp = path.join(__dirname, 'L0ValidSqlProjInputs.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed with valid sqlproj inputs');
            assert(tr.stdout.indexOf('ActionDetected') >= 0, 'should detect action and file type');
            assert(tr.stdout.indexOf('SQLPROJ') >= 0, 'should detect SQLPROJ file type');
        }, tr);
    });

    it('should fail when SqlPackage execution fails with non-zero exit code', async () => {
        const tp = path.join(__dirname, 'L0SqlPackageExecutionFailed.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.failed, 'task should fail when SqlPackage exits with non-zero code');
            assert(tr.stdout.indexOf('SqlPackageExecutionFailed') >= 0 || tr.errorIssues.some(e => e.includes('SqlPackage execution failed')),
                'should report SqlPackage execution failure');
        }, tr);
    });

    it('should succeed with script action and generate output file', async () => {
        const tp = path.join(__dirname, 'L0SqlPackageScriptAction.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed with script action');
            assert(tr.stdout.indexOf('ExecutingSqlPackage') >= 0 || tr.stdout.indexOf('script') >= 0,
                'should report executing SqlPackage script action');
        }, tr);
    });

    it('should quote the auto-generated /OutputPath when the temp directory contains spaces', async () => {
        const tp = path.join(__dirname, 'L0AutoGeneratedOutputPathWithSpaces.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed when Agent.TempDirectory contains a space');
            assert(tr.stdout.indexOf('/OutputPath:"') >= 0,
                'auto-generated /OutputPath should be double-quoted');
            assert(tr.stdout.indexOf('GeneratedOutputFiles') >= 0,
                'should use the auto-generated output directory');
        }, tr);
    });

    it('should succeed with azureSubscription and use SQL-scoped access token', async () => {
        const tp = path.join(__dirname, 'L0AzureSubscriptionWithToken.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed when azureSubscription is set and token acquired');
            assert(tr.stdout.indexOf('AccessTokenAcquired') >= 0, 'should report access token acquired');
        }, tr);
    });

    it('should use the sovereign cloud SQL audience and an isolated credential', async () => {
        const tp = path.join(__dirname, 'L0SovereignCloudIsolatedSqlCredential.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed against a US Gov service connection');
            assert(tr.stdout.indexOf('TOKEN_AUDIENCE:https://database.usgovcloudapi.net/') >= 0,
                'token should be requested with the US Gov SQL audience, not the public cloud one');
            assert(tr.stdout.indexOf('TOKEN_BASEURL:https://database.usgovcloudapi.net/') >= 0,
                'baseUrl must also carry the SQL audience for the ADAL managed identity path');
            assert(tr.stdout.indexOf('IS_SHARED_ARM_CREDENTIAL:false') >= 0,
                'token must come from a distinct credential object, not the shared endpoint credential');
        }, tr);
    });

    it('should still remove the firewall rule after acquiring the SQL token', async () => {
        const tp = path.join(__dirname, 'L0FirewallRuleRemovedAfterTokenAcquisition.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed with firewall management enabled');
            assert(tr.stdout.indexOf('ADD_RULE_TOKEN:token-for:https://management.azure.com/') >= 0,
                'the rule should be added with an ARM-scoped token');
            assert(tr.stdout.indexOf('REMOVE_RULE_TOKEN:token-for:https://management.azure.com/') >= 0,
                'cleanup must still get an ARM-scoped token after the SQL token was acquired');
            assert(tr.stdout.indexOf('FailedToRemoveFirewallRule') < 0,
                'the temporary firewall rule must not be leaked');
        }, tr);
    });

    it('should not request an access token for SQL authentication', async () => {
        const tp = path.join(__dirname, 'L0NoTokenForSqlAuth.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed with SQL authentication');
            assert(tr.stdout.indexOf('UNEXPECTED_TOKEN_REQUEST') < 0,
                'no token should be requested when the connection string carries credentials');
        }, tr);
    });

    it('should not reuse the ARM-built MSAL instance for the SQL token on managed identity', async () => {
        const tp = path.join(__dirname, 'L0MsiMsalCacheNotReused.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded,
                'SQL token must be issued for the SQL audience, not the ARM audience captured by the existing msalInstance');
        }, tr);
    });

    it('should not inject -b when the user specifies their own error handling', async () => {
        const tp = path.join(__dirname, 'L0SqlcmdRespectsUserErrorHandling.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should respect an explicit --exit-on-error=false');
        }, tr);
    });

    it('should fail when sqlcmd execution fails with non-zero exit code', async () => {
        const tp = path.join(__dirname, 'L0SqlcmdExecutionFailed.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.failed, 'task should fail when sqlcmd exits with non-zero code');
            assert(tr.stdout.indexOf('SqlcmdExecutionFailed') >= 0 || tr.errorIssues.some(e => e.includes('sqlcmd execution failed')),
                'should report sqlcmd execution failure');
        }, tr);
    });

    it('should succeed with AAD Default auth (-G, no credentials)', async () => {
        const tp = path.join(__dirname, 'L0SqlcmdAadDefaultAuth.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed with AAD Default auth');
        }, tr);
    });

    it('should succeed with AAD Password auth (-G + -U + SQLCMDPASSWORD)', async () => {
        const tp = path.join(__dirname, 'L0SqlcmdAadPasswordAuth.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed with AAD Password auth');
        }, tr);
    });

    it('should succeed with AAD Service Principal auth (--authentication-method)', async () => {
        const tp = path.join(__dirname, 'L0SqlcmdAadServicePrincipalAuth.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed with AAD Service Principal auth');
        }, tr);
    });

    it('should use ActiveDirectoryAzurePipelines for a Workload Identity Federation service connection', async () => {
        const tp = path.join(__dirname, 'L0SqlcmdWifUsesAzurePipelinesAuth.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed authenticating as the WIF service connection');
        }, tr);
    });

    it('should not override an explicitly requested managed identity with the WIF service connection', async () => {
        const tp = path.join(__dirname, 'L0SqlcmdMsiNotOverriddenByWif.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should honour Authentication=Active Directory Managed Identity');
            assert(tr.stdout.indexOf('ActiveDirectoryAzurePipelines') < 0,
                'must not substitute the service connection identity for the requested managed identity');
        }, tr);
    });

    it('should take the SP tenant id from the service connection', async () => {
        const tp = path.join(__dirname, 'L0SqlcmdSpAuthTenantFromSubscription.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed with clientId@tenantId built from the service connection');
        }, tr);
    });

    it('should use the same authentication mapping for the firewall probe as for deployment', async () => {
        const tp = path.join(__dirname, 'L0SqlcmdFirewallProbeUsesSharedAuth.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed with the probe using --authentication-method');
        }, tr);
    });
});

// These drive a real ApplicationTokenCredentials rather than a stub, so they fail if the
// library changes the shape createSqlScopedCredentials depends on - for example moving
// token_deferred/msalInstance/accessToken to true private fields or a WeakMap, which
// Object.assign would not copy and would silently break the isolation.
describe('SqlTokenCredentials - cloning a real ApplicationTokenCredentials', function () {
    this.timeout(10000);

    const { ApplicationTokenCredentials } = require('azure-pipelines-tasks-azure-arm-rest/azure-arm-common');
    const { createSqlScopedCredentials, getSqlAudienceFromEnvironment } = require('../src/SqlTokenCredentials');

    const ARM = 'https://management.azure.com/';
    const SQL = 'https://database.windows.net/';

    function newRealCredential(useMSAL: boolean, scheme: string) {
        return new ApplicationTokenCredentials(
            'connected-service',            // connectedServiceName
            'client-id',                    // clientId
            'tenant-id',                    // tenantId
            'client-secret',                // secret
            ARM,                            // baseUrl
            'https://login.microsoftonline.com/', // authorityUrl
            ARM,                            // activeDirectoryResourceId
            false,                          // isAzureStackEnvironment
            scheme,                         // scheme
            '',                             // msiClientId
            '',                             // authType
            '',                             // certFilePath
            false,                          // isADFSEnabled
            undefined,                      // access_token
            useMSAL                         // useMSAL
        );
    }

    it('should retain getToken from the prototype', () => {
        const real = newRealCredential(true, 'ServicePrincipal');
        const clone = createSqlScopedCredentials({ applicationTokenCredentials: real }, SQL);

        assert.strictEqual(typeof clone.getToken, 'function',
            'clone must still expose getToken - the prototype was not carried over');
        assert.strictEqual(Object.getPrototypeOf(clone), Object.getPrototypeOf(real),
            'clone should share the real prototype');
    });

    it('should point both resource fields at the SQL audience', () => {
        const real = newRealCredential(true, 'ManagedServiceIdentity');
        const clone = createSqlScopedCredentials({ applicationTokenCredentials: real }, SQL);

        assert.strictEqual(clone.activeDirectoryResourceId, SQL, 'ADAL SP and MSAL read this field');
        assert.strictEqual(clone.baseUrl, SQL, 'ADAL managed identity reads baseUrl');
    });

    it('should clear every token cache on the clone', () => {
        const real = newRealCredential(true, 'ManagedServiceIdentity');

        // Simulate a credential that has already served an ARM token, which is the state
        // after firewall management runs.
        (real as any).token_deferred = Promise.resolve('arm-adal-token');
        (real as any).msalInstance = { capturedResource: ARM };
        (real as any).accessToken = 'endpoint-supplied-arm-token';

        const clone = createSqlScopedCredentials({ applicationTokenCredentials: real }, SQL);

        assert.strictEqual(clone.token_deferred, undefined, 'ADAL memo must not be inherited');
        assert.strictEqual(clone.msalInstance, undefined, 'MSAL instance captures the resource at build time');
        assert.strictEqual(clone.accessToken, undefined, 'endpoint token is returned verbatim by getADALToken');
    });

    it('should leave the shared ARM credential untouched', () => {
        const real = newRealCredential(true, 'ServicePrincipal');
        (real as any).token_deferred = Promise.resolve('arm-adal-token');
        (real as any).msalInstance = { capturedResource: ARM };

        createSqlScopedCredentials({ applicationTokenCredentials: real }, SQL);

        assert.strictEqual(real.activeDirectoryResourceId, ARM, 'ARM credential audience must not change');
        assert.strictEqual(real.baseUrl, ARM, 'ARM credential baseUrl must not change');
        assert.notStrictEqual((real as any).token_deferred, undefined, 'ARM token cache must survive');
        assert.notStrictEqual((real as any).msalInstance, undefined, 'ARM MSAL instance must survive');
    });

    it('should preserve identity fields needed to authenticate', () => {
        const real = newRealCredential(false, 'ServicePrincipal');
        const clone = createSqlScopedCredentials({ applicationTokenCredentials: real }, SQL);

        assert.strictEqual(clone.getClientId(), real.getClientId(), 'client id must carry over');
        assert.strictEqual(clone.getTenantId(), real.getTenantId(), 'tenant id must carry over');
        assert.strictEqual(clone.getUseMSAL(), real.getUseMSAL(), 'MSAL/ADAL selection must carry over');
        assert.strictEqual(clone.scheme, real.scheme, 'scheme must carry over');
    });

    it('should derive sovereign cloud audiences', () => {
        assert.strictEqual(getSqlAudienceFromEnvironment('AzureUSGovernment'), 'https://database.usgovcloudapi.net/');
        assert.strictEqual(getSqlAudienceFromEnvironment('AzureChinaCloud'), 'https://database.chinacloudapi.cn/');
        assert.strictEqual(getSqlAudienceFromEnvironment('AzureGermanCloud'), 'https://database.cloudapi.de/');
        assert.strictEqual(getSqlAudienceFromEnvironment('AzureCloud'), SQL);
        assert.strictEqual(getSqlAudienceFromEnvironment(undefined as any), SQL, 'unknown environment falls back to public cloud');
    });
});



