import * as assert from 'assert';
import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import SqlConnectionConfig from '../src/SqlConnectionConfig';
import AzureSqlResourceManager, { AzureSqlServer } from '../src/AzureSqlResourceManager';
import SqlProjectBuilder from '../src/SqlProjectBuilder';

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
    
    describe('SqlProjectBuilder - Project name and output directory', function() {
        it('strips the project extension regardless of case', function() {
            assert.strictEqual(SqlProjectBuilder.getProjectName('/src/MyDb.sqlproj'), 'MyDb');
            assert.strictEqual(SqlProjectBuilder.getProjectName('/src/MyDb.SQLPROJ'), 'MyDb');
            assert.strictEqual(SqlProjectBuilder.getProjectName('/src/MyDb.SqlProj'), 'MyDb');
        });

        it('keeps a dot in the project name', function() {
            assert.strictEqual(SqlProjectBuilder.getProjectName('/src/Contoso.Sales.sqlproj'), 'Contoso.Sales');
        });

        // dotnet resolves --output against the current directory, while MSBuild resolves the
        // OutputPath property against the project directory. Detection has to match the tool, or a
        // nested project builds successfully and is then searched for in a directory that does not
        // exist. Both quote styles are covered because the tokenizer used here is the same one that
        // builds the command line.
        const projectFile = path.join('/src', 'App', 'MyDb.sqlproj');

        const cwdRelative: [string, string][] = [
            ['--output custom', 'recognises --output'],
            ['-o custom', 'recognises -o'],
            ['--output=custom', 'recognises --output='],
            [`--output "custom"`, 'recognises a double-quoted --output value'],
            [`--output 'custom'`, 'recognises a single-quoted --output value']
        ];

        cwdRelative.forEach(([args, description]) => {
            it(`${description}, resolved against the current directory`, function() {
                assert.strictEqual(
                    SqlProjectBuilder.findUserSpecifiedOutputDirectory(projectFile, args),
                    path.resolve(process.cwd(), 'custom'));
            });
        });

        const projectRelative: [string, string][] = [
            ['-p:OutputPath=custom', 'recognises the -p: property form'],
            ['--property:OutputPath=custom', 'recognises the --property: form'],
            ['/p:OutputPath=custom', 'recognises the /p: form'],
            [`-p:OutputPath="custom"`, 'recognises a double-quoted property value'],
            [`-p:OutputPath='custom'`, 'recognises a single-quoted property value']
        ];

        projectRelative.forEach(([args, description]) => {
            it(`${description}, resolved against the project directory`, function() {
                assert.strictEqual(
                    SqlProjectBuilder.findUserSpecifiedOutputDirectory(projectFile, args),
                    path.resolve(path.dirname(projectFile), 'custom'));
            });
        });

        it('keeps a quoted path containing spaces in one piece', function() {
            assert.strictEqual(
                SqlProjectBuilder.findUserSpecifiedOutputDirectory(projectFile, `-p:OutputPath="out dir"`),
                path.resolve(path.dirname(projectFile), 'out dir'));
            assert.strictEqual(
                SqlProjectBuilder.findUserSpecifiedOutputDirectory(projectFile, `-p:OutputPath='out dir'`),
                path.resolve(path.dirname(projectFile), 'out dir'));
        });

        it('reports no user-specified output when only the configuration is set', function() {
            assert.strictEqual(
                SqlProjectBuilder.findUserSpecifiedOutputDirectory('/src/MyDb.sqlproj', '-p:Configuration=Release'),
                undefined,
                'Configuration selects a directory MSBuild derives, so the task must pin its own instead');
        });
    });

    describe('SqlConnectionConfig - Mixed synonymous keys', function() {
        // SqlConnectionStringBuilder maps synonyms onto one property, so the last occurrence wins
        // regardless of which spelling it used. Preferring a fixed spelling would send sqlcmd, the
        // firewall probe or the /AccessToken SqlPackage path to a different target or credential
        // than the connection string handed to SqlPackage.
        it('takes the later server, whichever spelling it used', function() {
            const config = new SqlConnectionConfig('Data Source=old.database.windows.net;Server=new.database.windows.net;Database=db;User ID=u;Password=p');
            assert.strictEqual(config.Server, 'new.database.windows.net');
        });

        it('takes the later server when the aliases appear in the other order', function() {
            const config = new SqlConnectionConfig('Server=old.database.windows.net;Data Source=new.database.windows.net;Database=db;User ID=u;Password=p');
            assert.strictEqual(config.Server, 'new.database.windows.net');
        });

        it('takes the later database', function() {
            const config = new SqlConnectionConfig('Server=s.database.windows.net;Initial Catalog=olddb;Database=newdb;User ID=u;Password=p');
            assert.strictEqual(config.Database, 'newdb');
        });

        it('takes the later user id and password', function() {
            const config = new SqlConnectionConfig('Server=s.database.windows.net;Database=db;User ID=olduser;UID=newuser;Password=oldpass;PWD=newpass');
            assert.strictEqual(config.UserId, 'newuser');
            assert.strictEqual(config.Password, 'newpass');
        });

        it('takes the later encryption setting', function() {
            const config = new SqlConnectionConfig('Server=s.database.windows.net;Database=db;User ID=u;Password=p;Encrypt=False;Encrypt=Mandatory');
            assert.strictEqual(config.Encrypt, 'true');
        });

        it('takes the later connect timeout, whichever spelling it used', function() {
            const config = new SqlConnectionConfig('Server=s.database.windows.net;Database=db;User ID=u;Password=p;Connect Timeout=10;Connection Timeout=99');
            assert.strictEqual(config.ConnectTimeoutSeconds, 99);
        });
    });

    describe('SqlConnectionConfig - Encrypt mapping', function() {
        // go-sqlcmd v1.10 rejects an unknown -N value naming the set it accepts:
        //   [m[andatory] yes 1 t[rue] disable o[ptional] no 0 f[alse] s[trict]]
        // Mandatory and Optional are the current SqlClient spellings of True and False, so all of
        // these have to resolve to the same switch value rather than being dropped.
        const encryptValues: [string, string, string][] = [
            ['True', 'true', 'maps True'],
            ['Mandatory', 'true', 'maps Mandatory, the current spelling of True'],
            ['Yes', 'true', 'maps Yes'],
            ['1', 'true', 'maps 1'],
            ['False', 'false', 'maps False'],
            ['Optional', 'false', 'maps Optional, the current spelling of False'],
            ['No', 'false', 'maps No'],
            ['0', 'false', 'maps 0'],
            ['Strict', 'strict', 'maps Strict'],
            ['MANDATORY', 'true', 'is case-insensitive']
        ];

        encryptValues.forEach(([value, expected, description]) => {
            it(description, function() {
                const config = new SqlConnectionConfig(`Server=s.database.windows.net;Database=d;User Id=sa;Password=p;Encrypt=${value}`);
                assert.strictEqual(config.Encrypt, expected);
            });
        });

        it('rejects a value SqlClient does not define rather than connecting unencrypted', function() {
            assert.throws(() => {
                new SqlConnectionConfig('Server=s.database.windows.net;Database=d;User Id=sa;Password=p;Encrypt=bogus');
            }, /InvalidConnectionStringPropertyValue/);
        });
    });

    describe('SqlConnectionConfig - Firewall-capable target detection', function() {
        // Firewall management enumerates Microsoft.Sql/servers, so it only applies to Azure SQL
        // Database logical servers. Every other supported target must be excluded or the task
        // enables a step that cannot succeed.
        const targets: [string, boolean, string][] = [
            ['myserver.database.windows.net', true, 'an Azure SQL Database logical server'],
            ['myserver.database.usgovcloudapi.net', true, 'a logical server in a sovereign cloud'],
            ['myinstance.abc123def.database.windows.net', false, 'a managed instance, which adds a DNS zone label'],
            ['mydb.database.fabric.microsoft.com', false, 'Fabric SQL'],
            ['sqlserver01.contoso.com', false, 'SQL Server on premises'],
            ['10.0.0.4', false, 'SQL Server addressed by IP'],
            ['localhost', false, 'a local server']
        ];

        targets.forEach(([host, expected, description]) => {
            it(`${expected ? 'supports' : 'excludes'} ${description}`, function() {
                const config = new SqlConnectionConfig(`Server=${host};Database=db;User Id=sa;Password=p`);
                assert.strictEqual(config.IsAzureSqlDatabaseServer, expected);
            });
        });

        it('ignores a port when classifying the target', function() {
            const config = new SqlConnectionConfig('Server=tcp:myserver.database.windows.net,1433;Database=db;User Id=sa;Password=p');
            assert.strictEqual(config.IsAzureSqlDatabaseServer, true);
        });
    });

    describe('AzureSqlResourceManager - Server matching', function() {
        // ARM reports the short name plus the cloud-specific fully qualified name. Firewall
        // management must locate the server in every cloud, not only the public one.
        const server = (name: string, fullyQualifiedDomainName: string): AzureSqlServer => ({
            id: `/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Sql/servers/${name}`,
            name,
            location: 'eastus',
            properties: { fullyQualifiedDomainName, state: 'Ready', version: '12.0' }
        });

        const matches: [AzureSqlServer, string, string][] = [
            [server('myserver', 'myserver.database.windows.net'), 'myserver.database.windows.net', 'matches a public cloud host'],
            [server('myserver', 'myserver.database.usgovcloudapi.net'), 'myserver.database.usgovcloudapi.net', 'matches a US Government host'],
            [server('myserver', 'myserver.database.chinacloudapi.cn'), 'myserver.database.chinacloudapi.cn', 'matches a China cloud host'],
            [server('myserver', 'myserver.database.windows.net'), 'MyServer.Database.Windows.Net', 'matches regardless of case'],
            [server('myserver', 'myserver.database.windows.net'), 'myserver', 'matches a bare server name'],
            [server('myserver', ''), 'myserver.database.usgovcloudapi.net', 'falls back to the first label when ARM reports no domain name']
        ];

        matches.forEach(([sqlServer, requested, description]) => {
            it(description, function() {
                assert.strictEqual(AzureSqlResourceManager.matchesRequestedServer(sqlServer, requested), true);
            });
        });

        it('does not match a different server', function() {
            const sqlServer = server('myserver', 'myserver.database.windows.net');
            assert.strictEqual(AzureSqlResourceManager.matchesRequestedServer(sqlServer, 'otherserver.database.windows.net'), false);
        });
    });

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
            [`Data Source=test1.database.windows.net;Initial Catalog=testdb;UID=user;PWD=placeholder`, `placeholder`, 'accepts the UID and PWD synonyms'],
            [`Addr=test1.database.windows.net;Database=testdb;User=user;Password=placeholder`, `placeholder`, 'accepts the Addr and User synonyms'],
            [`Address=test1.database.windows.net;Database=testdb;User Id=user;Password=placeholder`, `placeholder`, 'accepts the Address synonym'],
            [`Network Address=test1.database.windows.net;Database=testdb;User Id=user;Password=placeholder`, `placeholder`, 'accepts the Network Address synonym'],
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
            [`Server=test1.database.windows.net;Database=testdb;Authentication='ActiveDirectoryMSI';`, `UnsupportedAuthentication`, 'unknown Authentication keyword rejected'],
            // Values the task claims to apply. Ignoring them ran with a different setting than the
            // one asked for, and the key counted as applied so no warning was raised either.
            [`Server=test1.database.windows.net;Database=testdb;User Id=u;Password=p;Connect Timeout=abc`, `InvalidConnectionStringPropertyValue`, 'non-numeric Connect Timeout'],
            [`Server=test1.database.windows.net;Database=testdb;User Id=u;Password=p;ApplicationIntent=foo`, `InvalidConnectionStringPropertyValue`, 'unknown ApplicationIntent'],
            [`Server=test1.database.windows.net;Database=testdb;User Id=u;Password=p;TrustServerCertificate=bogus`, `InvalidConnectionStringPropertyValue`, 'non-boolean TrustServerCertificate']
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

    it('should fail when path is an existing directory with a supported extension', async () => {
        const tp = path.join(__dirname, 'L0PathIsDirectory.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.failed, 'tl.checkPath only tests existence, so a directory has to be rejected separately');
            assert(tr.stdout.indexOf('loc_mock_FilePathInputIsDirectory') >= 0,
                'the error must say the input is a directory rather than blaming the tool');
            assert(tr.invokedToolCount === 0,
                'a directory must never reach SqlPackage or sqlcmd');
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

    it('should pass the auto-generated /OutputPath intact when the temp directory contains spaces', async () => {
        const tp = path.join(__dirname, 'L0AutoGeneratedOutputPathWithSpaces.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed when Agent.TempDirectory contains a space');
            assert(tr.stdout.indexOf('/OutputPath:"') < 0,
                'the path must not be quoted; SqlPackage rejects quotes as illegal path characters');
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

    it('should ignore filePath inputs the agent rooted to the working directory', async () => {
        const tp = path.join(__dirname, 'L0BlankFilePathInputsIgnored.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should treat a directory-valued filePath input as not specified');
            assert(tr.stdout.indexOf('should have been ignored') < 0,
                'sqlcmdPath pointing at a directory must not be used as the executable');
        }, tr);
    });

    it('should fail when an explicitly supplied filePath input points at a directory', async () => {
        const tp = path.join(__dirname, 'L0ExplicitDirectoryFilePathFails.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.failed, 'a supplied publishProfile pointing at a directory must fail');
            assert(tr.stdout.indexOf('FilePathInputIsDirectory') >= 0 || tr.stdout.indexOf('points to a directory') >= 0,
                'the error must name the input and the directory');
            assert(tr.stdout.indexOf('/Action:Publish') < 0,
                'SqlPackage must not run: it would deploy with default properties instead of the requested profile');
        }, tr);
    });

    it('should strip syntactic quotes from a user-specified output path containing spaces', async () => {
        const tp = path.join(__dirname, 'L0UserOutputPathWithSpaces.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            // The mocked command is keyed on the unquoted path, so succeeding at all means the
            // quotes were removed. Asserting on stdout alone would match the debug line that
            // echoes the raw input, which legitimately still contains them.
            assert(tr.succeeded, 'a quoted output path containing spaces must reach SqlPackage without the quote characters');
        }, tr);
    });

    it('should treat /op as a user-specified output path and not add another', async () => {
        const tp = path.join(__dirname, 'L0UserOutputPathShortForm.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, '/op is the documented short form and must be recognised');
            assert(tr.stdout.indexOf('GeneratedOutputFiles') < 0,
                'no auto-generated output path may be appended when the user already supplied /op');
        }, tr);
    });

    it('should reject a script path containing a comma', async () => {
        const tp = path.join(__dirname, 'L0SqlcmdCommaInPathRejected.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.failed, 'sqlcmd reads commas in -i as file separators, so the path must be refused');
            assert(tr.stdout.indexOf('ScriptPathContainsComma') >= 0 || tr.stdout.indexOf('contains a comma') >= 0,
                'the error must name the path and say what to change');
            assert(tr.stdout.indexOf('-i ') < 0,
                'sqlcmd must not run: it would look for files that do not exist');
        }, tr);
    });

    it('should pass a script path containing spaces through unquoted', async () => {
        const tp = path.join(__dirname, 'L0SqlcmdSpaceInPathAllowed.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'spaces are ordinary in paths and go-sqlcmd accepts them unquoted');
            assert(tr.stdout.indexOf('"""') < 0,
                'quoting a path with spaces is what breaks it, so none may be added');
        }, tr);
    });

    it('should translate connection string security properties into sqlcmd switches', async () => {
        const tp = path.join(__dirname, 'L0SqlcmdConnectionPropertiesApplied.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded,
                'Encrypt, ApplicationIntent and Connect Timeout must reach sqlcmd as -N, -K and -l');
            assert(tr.stdout.indexOf('-C') < 0,
                'TrustServerCertificate=False must not disable certificate validation');
        }, tr);
    });

    it('should pass the sovereign Entra authority to sqlcmd', async () => {
        const tp = path.join(__dirname, 'L0SovereignAuthorityPassedToSqlcmd.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'the deployment should run against the sovereign endpoint');
            const overrides = tr.stdout.split('\n')
                .find(line => line.indexOf('sqlcmd environment overrides:') >= 0);
            assert(overrides, 'the applied environment overrides must be recorded for diagnosis');
            assert(overrides.indexOf('AZURE_AUTHORITY_HOST') >= 0,
                'without this azidentity contacts the public Entra authority, not the sovereign one');
        }, tr);
    });

    it('should keep the port on /TargetServerName for a managed instance public endpoint', async () => {
        const tp = path.join(__dirname, 'L0ManagedInstancePortPreserved.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded,
                'the MI public endpoint listens on 3342, so dropping the port sends the deployment to 1433');
        }, tr);
    });

    it('should not run sqlcmd when the selected service connection cannot be materialized', async () => {
        const tp = path.join(__dirname, 'L0IncompleteWifCredentialsFail.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.failed, 'an unusable service connection must stop the deployment');
            assert(tr.stdout.indexOf('loc_mock_ServiceConnectionCredentialsUnavailable') >= 0,
                'the error must name the service connection that could not be used');
            // Discovery logs the sqlcmd path even when it is never executed, so the assertion is on
            // an actual invocation rather than on the path appearing in the log.
            assert(tr.stdout.indexOf('[command]') < 0,
                'sqlcmd must not run: without the service connection environment it would authenticate as the agent');
        }, tr);
    });

    it('should not run sqlcmd when the selected service connection is a Publish Profile', async () => {
        const tp = path.join(__dirname, 'L0PublishProfileEndpointRejected.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.failed, 'a Publish Profile endpoint carries no usable credential and must stop the deployment');
            assert(tr.stdout.indexOf('loc_mock_ServiceConnectionCredentialsUnavailable') >= 0,
                'the error must name the service connection that could not be used');
            // The endpoint has no tenantID, which is what used to short-circuit ahead of the scheme
            // check and let sqlcmd run under the agent's ambient identity.
            assert(tr.stdout.indexOf('[command]') < 0,
                'sqlcmd must not run: ActiveDirectoryDefault with no injected environment resolves the agent identity');
        }, tr);
    });

    it('should send Encrypt=Mandatory to sqlcmd as -N true', async () => {
        const tp = path.join(__dirname, 'L0SqlcmdEncryptMandatory.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded,
                'Mandatory is the current spelling of True and must not be dropped, which would leave the connection unencrypted');
        }, tr);
    });

    it('should pass ServerCertificate to sqlcmd as -J', async () => {
        const tp = path.join(__dirname, 'L0SqlcmdServerCertificatePinned.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded,
                'dropping the pin validates against the machine trust store instead of the certificate the caller named');
        }, tr);
    });

    it('should pin the managed identity credential for an MSI service connection', async () => {
        const tp = path.join(__dirname, 'L0SqlcmdMsiUsesManagedIdentity.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded,
                'ActiveDirectoryDefault lets the credential chain pick an ambient identity and ignores msiClientId');
        }, tr);
    });

    it('should warn about connection string properties that sqlcmd cannot honour', async () => {
        const tp = path.join(__dirname, 'L0SqlcmdConnectionPropertiesWarned.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'unsupported properties are a warning, not a failure');
            // Scoped to the warning line: the connection string is echoed in debug output, so
            // searching the whole log would match the user's own input rather than the warning.
            const warning = tr.stdout.split('\n')
                .find(line => line.indexOf('loc_mock_SqlcmdConnectionPropertiesNotApplied') >= 0);
            assert(warning, 'the user must be told which properties were not applied');
            assert(warning.indexOf('Pooling') >= 0 && warning.indexOf('Application Name') >= 0,
                'the warning must name the properties, using the spelling the user typed');
            assert(warning.indexOf('Encrypt') < 0 && warning.indexOf('HostNameInCertificate') < 0,
                'properties that do have a switch must not be reported as unapplied');
        }, tr);
    });

    it('should not substitute the service connection identity for Integrated authentication', async () => {
        const tp = path.join(__dirname, 'L0IntegratedAuthNotSubstituted.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'the connection string must be passed through so the domain identity is used');
            assert(tr.stdout.indexOf('/AccessToken:') < 0,
                'Integrated names a specific identity, so a service connection token must not be injected');
        }, tr);
    });

    it('should find the dacpac for a nested project built with a relative --output', async () => {
        const tp = path.join(__dirname, 'L0SqlProjNestedRelativeOutput.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded,
                'dotnet resolves --output against the current directory, so a nested project must be searched there');
            assert(tr.stdout.indexOf('loc_mock_DacpacNotFoundAfterBuild') < 0,
                'building successfully and then looking in the project directory is the defect');
        }, tr);
    });

    it('should find the dacpac when the configuration is set with MSBuild property syntax', async () => {
        const tp = path.join(__dirname, 'L0SqlProjMsBuildPropertyConfiguration.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded,
                '-p:Configuration=Release must not send the dacpac lookup to bin/Debug');
            assert(tr.stdout.indexOf('loc_mock_DacpacNotFoundAfterBuild') < 0,
                'the build succeeding while the dacpac is looked for elsewhere is the defect');
        }, tr);
    });

    it('should not default firewall management on for a managed instance target', async () => {
        const tp = path.join(__dirname, 'L0FirewallNotDefaultedForManagedInstance.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'supplying azureSubscription for authentication must not enable firewall management');
            assert(tr.stdout.indexOf('FIREWALL_PROBE_RAN') < 0,
                'a managed instance has no Azure SQL firewall rules, so the probe must not run');
            assert(tr.stdout.indexOf('ARM_LOOKUP_RAN') < 0,
                'a managed instance is not returned by Microsoft.Sql/servers, so it must not be looked up');
        }, tr);
    });

    it('should fail clearly when firewall management is requested for a managed instance', async () => {
        const tp = path.join(__dirname, 'L0FirewallExplicitOnManagedInstanceFails.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.failed, 'an explicit request for an unsupported target must fail');
            assert(tr.stdout.indexOf('loc_mock_FirewallManagementRequiresAzureSqlDatabase') >= 0,
                'the error must name the real constraint, not report the server as missing');
            assert(tr.stdout.indexOf('loc_mock_SQLServerNotFoundInSubscription') < 0,
                'failing inside the ARM enumeration is what made this confusing');
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
            assert(tr.stdout.indexOf('"sqlcmdCredentialSource":"tenantOnly"') >= 0,
                'a tenant id was injected, so telemetry must not report that nothing was supplied');
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

    it('should authenticate sqlcmd with a certificate-backed service principal', async () => {
        const tp = path.join(__dirname, 'L0SqlcmdCertificateAuth.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed with a certificate service connection');
            // The command line is identical either way, so assert on the resolved credential
            // source: 'default' means it fell through to DefaultAzureCredential, which has no
            // identity on a hosted agent.
            assert(tr.stdout.indexOf('"sqlcmdCredentialSource":"clientCertificate"') >= 0,
                'certificate connections must resolve to AZURE_CLIENT_CERTIFICATE_PATH, not DefaultAzureCredential');
        }, tr);
    });

    it('should fail rather than deploy with ambient credentials when the service connection token cannot be acquired', async () => {
        const tp = path.join(__dirname, 'L0TokenFailureDoesNotFallBackToAmbientAuth.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.failed, 'task must fail when the SQL access token cannot be acquired');
            assert(tr.stdout.indexOf('AccessTokenAcquisitionFailed') >= 0 || tr.stdout.indexOf('Could not acquire a database access token') >= 0,
                'the failure must name the service connection and the underlying token error');
            assert(tr.stdout.indexOf('/Action:Publish') < 0,
                'SqlPackage must not run: doing so would deploy under whatever identity its own credential chain resolves');
        }, tr);
    });

    it('should capture probe output and provision a rule for the blocked client IP', async () => {
        const tp = path.join(__dirname, 'L0FirewallProbeCapturesBlockedIp.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'task should succeed after provisioning a firewall rule');
            assert(tr.stdout.indexOf('ADD_RULE_IP:203.0.113.10') >= 0,
                'the IP must be parsed out of the probe output; an empty capture would silently skip firewall provisioning');
            assert(tr.stdout.indexOf('FailedToDetectIPAddress') < 0,
                'a captured firewall error must not surface as a failed IP detection');
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



