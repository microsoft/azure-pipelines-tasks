import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import * as fs from 'fs';

export default class SqlPackageHelper {
    /**
     * Discovers SqlPackage executable following the specified discovery order.
     * Discovery order per specification:
     * 1. sqlpackagePath input (if provided)
     * 2. dotnet tool: ~/.dotnet/tools/sqlpackage or %USERPROFILE%\.dotnet\tools\sqlpackage.exe
     * 3. Windows only: DacFramework MSI at C:\Program Files\Microsoft SQL Server\{version}\DAC\bin\SqlPackage.exe
     * 4. PATH fallback
     * 
     * @param sqlpackagePathInput Optional path from sqlpackagePath input
     * @returns Absolute path to SqlPackage executable
     * @throws Error if SqlPackage is not found
     */
    public static async findSqlPackage(sqlpackagePathInput?: string): Promise<string> {
        tl.debug('Starting SqlPackage discovery');

        // 1. Check sqlpackagePath input
        if (sqlpackagePathInput) {
            tl.debug(`Checking user-provided sqlpackagePath: ${sqlpackagePathInput}`);
            if (fs.existsSync(sqlpackagePathInput)) {
                tl.debug(`Found SqlPackage at user-provided path: ${sqlpackagePathInput}`);
                return sqlpackagePathInput;
            } else {
                throw new Error(tl.loc('SqlPackageNotFoundAtPath', sqlpackagePathInput));
            }
        }

        // 2. Check dotnet tool location
        const dotnetToolPath = this.getDotnetToolPath();
        tl.debug(`Checking dotnet tool location: ${dotnetToolPath}`);
        if (fs.existsSync(dotnetToolPath)) {
            tl.debug(`Found SqlPackage at dotnet tool location: ${dotnetToolPath}`);
            return dotnetToolPath;
        }

        // 3. Windows only: Check DacFramework MSI locations
        if (process.platform === 'win32') {
            const dacFrameworkPath = await this.findDacFrameworkMsi();
            if (dacFrameworkPath) {
                tl.debug(`Found SqlPackage at DacFramework MSI location: ${dacFrameworkPath}`);
                return dacFrameworkPath;
            }
        }

        // 4. PATH fallback
        const sqlpackageInPath = tl.which('sqlpackage', false);
        if (sqlpackageInPath) {
            tl.debug(`Found SqlPackage in PATH: ${sqlpackageInPath}`);
            return sqlpackageInPath;
        }

        // Not found anywhere - fail with actionable error
        throw new Error(tl.loc('SqlPackageNotFound'));
    }

    /**
     * Gets the expected dotnet tool path for SqlPackage based on platform.
     * Linux/macOS: ~/.dotnet/tools/sqlpackage
     * Windows: %USERPROFILE%\.dotnet\tools\sqlpackage.exe
     */
    private static getDotnetToolPath(): string {
        const homeDir = process.platform === 'win32' 
            ? process.env['USERPROFILE'] 
            : process.env['HOME'];

        if (!homeDir) {
            tl.debug('HOME/USERPROFILE environment variable not set');
            return '';
        }

        const toolName = process.platform === 'win32' ? 'sqlpackage.exe' : 'sqlpackage';
        return path.join(homeDir, '.dotnet', 'tools', toolName);
    }

    /**
     * Searches for SqlPackage installed via DacFramework MSI on Windows.
     * Checks C:\Program Files\Microsoft SQL Server\{version}\DAC\bin\SqlPackage.exe
     * Looks for common SQL Server versions in descending order.
     */
    private static async findDacFrameworkMsi(): Promise<string | null> {
        tl.debug('Searching for DacFramework MSI installations');

        const sqlServerBasePath = 'C:\\Program Files\\Microsoft SQL Server';
        
        // Common SQL Server version numbers in descending order (newest first)
        const versions = ['170', '160', '150', '140', '130', '120', '110'];

        for (const version of versions) {
            const sqlPackagePath = path.join(sqlServerBasePath, version, 'DAC', 'bin', 'SqlPackage.exe');
            tl.debug(`Checking: ${sqlPackagePath}`);
            
            if (fs.existsSync(sqlPackagePath)) {
                tl.debug(`Found DacFramework MSI installation at version ${version}`);
                return sqlPackagePath;
            }
        }

        tl.debug('No DacFramework MSI installation found');
        return null;
    }
}
