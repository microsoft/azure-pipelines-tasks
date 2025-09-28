const ncp = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { mkdir, test, rm } = require('shelljs');
const { promisify } = require('util');

const args = require('minimist')(process.argv.slice(2));

// Constants to eliminate magic numbers and strings
const ASA_CONSTANTS = {
    COLLECTION_PREFIX: 'asa-',
    DEFAULT_CLEANUP_TIMEOUT: 10000,
    SKIP_DIRECTORIES: [
        'node_modules', '.git', 'bin', 'obj', '_build', 
        '.vscode', 'temp', 'tmp', 'Tests', 'test'
    ],
    PATH_VALIDATION_REGEX: /^[a-zA-Z0-9-_.]+$/,
    BASELINE_SUFFIX: '-baseline',
    POSTBUILD_SUFFIX: '-postbuild',
    ASA_VERSION_TIMEOUT: 5000,
    CONFIG_WATCH_DEBOUNCE: 1000
};

// Promisify child_process.exec for consistent async operations
const execAsync = promisify(ncp.exec);

// Structured logger for better observability
const logger = {
    info: (msg, context = {}) => {
        const logMsg = `[ASA] ${new Date().toISOString()} ${msg}`;
        console.log(Object.keys(context).length > 0 ? `${logMsg} ${JSON.stringify(context)}` : logMsg);
    },
    warn: (msg, context = {}) => {
        const logMsg = `[ASA] ${new Date().toISOString()} ⚠️  ${msg}`;
        console.warn(Object.keys(context).length > 0 ? `${logMsg} ${JSON.stringify(context)}` : logMsg);
    },
    error: (msg, context = {}) => {
        const logMsg = `[ASA] ${new Date().toISOString()} ❌ ${msg}`;
        console.error(Object.keys(context).length > 0 ? `${logMsg} ${JSON.stringify(context)}` : logMsg);
    },
    debug: (msg, context = {}) => {
        if (process.env.ASA_DEBUG) {
            const logMsg = `[ASA] ${new Date().toISOString()} 🔍 ${msg}`;
            console.log(Object.keys(context).length > 0 ? `${logMsg} ${JSON.stringify(context)}` : logMsg);
        }
    }
};

// Configuration schema for validation
const ASA_CONFIG_SCHEMA = {
    enabled: { type: 'boolean', default: false },
    highRiskTasks: { type: 'array', default: ['PowerShellV2', 'AzureCLIV1', 'AzureCLIV2', 'DockerV2', 'DockerComposeV1', 'DockerComposeV2'] },
    timeout: { type: 'number', min: 1000, max: 300000, default: 30000 },
    reportTimeout: { type: 'number', min: 1000, max: 60000, default: 15000 },
    keepCollections: { type: 'number', min: 1, max: 10, default: 2 },
    scanMode: { type: 'string', enum: ['task-only', 'full'], default: 'task-only' }
};

// Paths
const repoPath = path.join(__dirname, '..');
const asaReportsPath = path.join(repoPath, '_asa-reports');
const asaConfigPath = path.join(__dirname, 'asa-config.json');

/**
 * Simple ASA Security Analyzer - Performance Optimized by Default
 * Single implementation for Azure Pipelines Tasks security analysis
 * 
 * @class ASAAnalyzer
 * @description Provides security analysis capabilities for Azure Pipeline tasks
 * using Microsoft's Attack Surface Analyzer (ASA) tool
 */
class ASAAnalyzer {
    /**
     * @typedef {Object} ASAConfig
     * @property {boolean} enabled - Whether ASA is enabled
     * @property {string[]} highRiskTasks - List of high-risk task names
     * @property {number} timeout - Command timeout in milliseconds
     * @property {number} reportTimeout - Report generation timeout
     * @property {number} keepCollections - Number of collections to keep
     * @property {'task-only'|'full'} scanMode - Scanning mode
     */
    
    constructor() {
        this.config = this.loadConfig();
        this.asaExecutable = this.findASA();
        this.collectionId = `${ASA_CONSTANTS.COLLECTION_PREFIX}${Date.now()}`;
        this.activeCollections = new Map();
        this.configWatcher = null;
        this.isShuttingDown = false;
        
        // Enable ASA if requested or configured
        this.enabled = this.shouldEnable();
        
        if (this.enabled && !this.asaExecutable) {
            logger.warn('ASA requested but not found. Install: dotnet tool install --global microsoft.cst.attacksurfaceanalyzer.cli');
            this.enabled = false;
        }
        
        if (this.enabled) {
            this.initReportsDir();
            this.setupConfigWatcher();
            logger.info(`ASA initialized with collection ID: ${this.collectionId}`);
        }
        
        // Setup graceful shutdown handlers with proper binding
        this.boundShutdown = this.gracefulShutdown.bind(this);
        process.on('SIGINT', this.boundShutdown);
        process.on('SIGTERM', this.boundShutdown);
        process.on('beforeExit', this.boundShutdown);
    }

    /**
     * Setup configuration file watcher for hot reloading
     */
    setupConfigWatcher() {
        if (test('-f', asaConfigPath)) {
            let debounceTimer = null;
            
            this.configWatcher = fs.watchFile(asaConfigPath, (curr, prev) => {
                if (curr.mtime > prev.mtime) {
                    // Debounce rapid file changes
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        logger.info('ASA config file changed, reloading...');
                        this.reloadConfig();
                    }, ASA_CONSTANTS.CONFIG_WATCH_DEBOUNCE);
                }
            });
            
            logger.debug('ASA config file watcher setup');
        }
    }
    
    /**
     * Reload configuration from file
     */
    reloadConfig() {
        try {
            const oldEnabled = this.enabled;
            this.config = this.loadConfig();
            this.enabled = this.shouldEnable();
            
            if (oldEnabled !== this.enabled) {
                logger.info(`ASA ${this.enabled ? 'enabled' : 'disabled'} via config reload`);
            }
        } catch (error) {
            logger.error(`Config reload failed: ${error.message}`);
        }
    }

    /**
     * Gracefully shutdown ASA operations and clean up resources
     */
    gracefulShutdown() {
        if (this.isShuttingDown) {
            return; // Prevent multiple shutdown calls
        }
        
        this.isShuttingDown = true;
        logger.debug('ASA graceful shutdown initiated');
        
        // Clean up active collections
        if (this.activeCollections.size > 0) {
            logger.info(`ASA graceful shutdown - cleaning up ${this.activeCollections.size} active collections`);
            this.activeCollections.clear();
        }
        
        // Clean up watchers
        if (this.configWatcher) {
            fs.unwatchFile(asaConfigPath);
            this.configWatcher = null;
            logger.debug('ASA config file watcher cleaned up');
        }
        
        // Remove event listeners to prevent memory leaks
        process.removeListener('SIGINT', this.boundShutdown);
        process.removeListener('SIGTERM', this.boundShutdown);
        process.removeListener('beforeExit', this.boundShutdown);
        
        logger.debug('ASA graceful shutdown completed');
    }

    /**
     * Validate input parameters to prevent command injection
     * @param {string} value - Value to validate
     * @param {string} name - Parameter name for error messages
     * @param {RegExp} pattern - Validation pattern (default: safe characters only)
     * @throws {Error} When validation fails
     */
    validateInput(value, name, pattern = ASA_CONSTANTS.PATH_VALIDATION_REGEX) {
        if (!value || typeof value !== 'string') {
            throw new Error(`${name} must be a non-empty string`);
        }
        if (!pattern.test(value)) {
            throw new Error(`${name} contains invalid characters: ${value}`);
        }
        return value;
    }

    /**
     * Validate configuration against schema
     */
    validateConfig(config) {
        const validated = {};
        
        for (const [key, schema] of Object.entries(ASA_CONFIG_SCHEMA)) {
            const value = config[key] ?? schema.default;
            
            // Type validation
            if (schema.type === 'boolean' && typeof value !== 'boolean') {
                throw new Error(`Config ${key} must be a boolean`);
            }
            if (schema.type === 'number' && typeof value !== 'number') {
                throw new Error(`Config ${key} must be a number`);
            }
            if (schema.type === 'string' && typeof value !== 'string') {
                throw new Error(`Config ${key} must be a string`);
            }
            if (schema.type === 'array' && !Array.isArray(value)) {
                throw new Error(`Config ${key} must be an array`);
            }
            
            // Range validation
            if (schema.min !== undefined && value < schema.min) {
                throw new Error(`Config ${key} must be >= ${schema.min}`);
            }
            if (schema.max !== undefined && value > schema.max) {
                throw new Error(`Config ${key} must be <= ${schema.max}`);
            }
            
            // Enum validation
            if (schema.enum && !schema.enum.includes(value)) {
                throw new Error(`Config ${key} must be one of: ${schema.enum.join(', ')}`);
            }
            
            validated[key] = value;
        }
        
        return validated;
    }

    /**
     * Load configuration with performance defaults
     */
    loadConfig() {
        let config = {};
        
        try {
            if (test('-f', asaConfigPath)) {
                const configData = JSON.parse(fs.readFileSync(asaConfigPath, 'utf8'));
                config = configData.asaConfig || {};
                logger.debug(`Loaded ASA config from ${asaConfigPath}`);
            } else {
                logger.debug('No ASA config file found, using defaults');
            }
        } catch (error) {
            logger.error(`ASA config error: ${error.message}`);
            config = {}; // Fall back to defaults
        }
        
        try {
            return this.validateConfig(config);
        } catch (error) {
            logger.error(`ASA config validation failed: ${error.message}`);
            // Return safe defaults on validation failure
            return this.validateConfig({});
        }
    }

    /**
     * Check if ASA should be enabled
     */
    shouldEnable() {
        return args.enableAsaAnalysis || 
               process.env.ASA_ENABLED === '1' || 
               this.config.enabled === true;
    }

    /**
     * Check if task should be analyzed
     */
    shouldAnalyze(taskName) {
        return this.enabled && 
               (this.config.highRiskTasks || []).includes(taskName);
    }

    /**
     * Handle errors with proper context and classification
     * @param {Error} error - The error object
     * @param {string} operation - Operation that failed
     * @param {string} taskName - Task name (if applicable)
     * @param {number} duration - Operation duration in ms
     */
    handleError(error, operation, taskName = null, duration = 0) {
        const context = {
            operation,
            taskName,
            duration: `${duration}ms`,
            collectionId: this.collectionId,
            enabled: this.enabled,
            timestamp: new Date().toISOString()
        };
        
        if (error.code === 'ETIMEDOUT') {
            logger.warn(`${operation} timed out after ${duration}ms`, context);
        } else if (error.status === 127) {
            logger.error('ASA executable not found - disabling ASA for this session', context);
            this.enabled = false;
        } else if (error.status === 1) {
            logger.warn(`${operation} failed with exit code 1`, context);
        } else {
            logger.error(`${operation} failed unexpectedly: ${error.message}`, context);
            
            if (process.env.ASA_DEBUG) {
                logger.debug(`Error stack: ${error.stack}`);
            }
        }
    }

    /**
     * Find ASA executable with better error handling
     * @returns {string|null} Path to ASA executable or null if not found
     */
    findASA() {
        const paths = [
            'asa',
            'asa.exe',
            path.join(os.homedir(), '.dotnet', 'tools', 'asa'),
            path.join(os.homedir(), '.dotnet', 'tools', 'asa.exe')
        ];

        for (const asaPath of paths) {
            try {
                const result = ncp.execSync(`"${asaPath}" --version`, { 
                    stdio: 'pipe', 
                    timeout: ASA_CONSTANTS.ASA_VERSION_TIMEOUT,
                    encoding: 'utf8'
                });
                logger.debug(`Found ASA executable at: ${asaPath}`);
                return asaPath;
            } catch (error) {
                // ASA returns exit code 1 even for --version, so check stdout/stderr for version info
                const output = (error.stdout || '') + (error.stderr || '');
                if (output.includes('Asa ') || output.includes('AttackSurfaceAnalyzer')) {
                    logger.debug(`Found ASA executable (exit code ${error.status}) at: ${asaPath}`);
                    return asaPath;
                }
                
                // Only log as debug if it's a real "not found" error (exit code 127)
                if (error.status === 127) {
                    logger.debug(`ASA not found at: ${asaPath}`);
                } else {
                    logger.debug(`ASA check failed at ${asaPath} with exit code ${error.status}`);
                }
            }
        }
        
        logger.debug('ASA executable not found in any standard location');
        return null;
    }

    /**
     * Initialize reports directory
     */
    initReportsDir() {
        if (!test('-d', asaReportsPath)) {
            mkdir('-p', asaReportsPath);
        }
    }

    /**
     * Build fast ASA command with input validation
     * @param {string} runId - Unique run identifier
     * @param {string} taskName - Task name to analyze
     * @returns {string} Complete ASA command string
     * @throws {Error} When input validation fails
     */
    buildCommand(runId, taskName) {
        // Validate inputs to prevent command injection
        this.validateInput(runId, 'runId');
        if (taskName) {
            this.validateInput(taskName, 'taskName');
        }
        
        const command = [`"${this.asaExecutable}"`, 'collect', '--runid', `"${runId}"`];
        
        // File system analysis only for performance
        command.push('--file-system');
        
        // Scan only task directory for speed
        if (this.config.scanMode === 'task-only' && taskName) {
            // Secure path construction to prevent path traversal
            const sanitizedTaskName = path.basename(taskName);
            const taskDir = path.resolve('Tasks', sanitizedTaskName);
            const tasksRoot = path.resolve('Tasks');
            
            // Validate that taskDir is within Tasks directory
            if (!taskDir.startsWith(tasksRoot + path.sep) && taskDir !== tasksRoot) {
                throw new Error(`Invalid task directory path: ${taskName}`);
            }
            
            command.push('--directories', `"${taskDir}"`);
            
            // Skip common directories using constants
            const skipDirs = ASA_CONSTANTS.SKIP_DIRECTORIES.join(',');
            command.push('--skip-directories', `"${skipDirs}"`);
        }
        
        // Performance optimizations
        command.push('--lowmemoryusage', '--singlethread', '--quiet');
        
        const fullCommand = command.join(' ');
        logger.debug(`Built ASA command: ${fullCommand}`);
        return fullCommand;
    }

    /**
     * Collect baseline before build
     * @param {string} taskName - Name of task to collect baseline for
     * @returns {Promise<void>}
     * @throws {Error} When input validation fails
     */
    async collectBaseline(taskName) {
        if (!this.shouldAnalyze(taskName)) {
            logger.debug(`Skipping ASA baseline for ${taskName} (not in high-risk tasks)`);
            return;
        }

        logger.info(`ASA baseline: ${taskName}`);
        const startTime = Date.now();
        
        try {
            const baselineId = `${this.collectionId}-${taskName}${ASA_CONSTANTS.BASELINE_SUFFIX}`;
            const command = this.buildCommand(baselineId, taskName);

            // Use execSync for now but with better error handling
            ncp.execSync(command, { 
                stdio: 'pipe',
                timeout: this.config.timeout,
                encoding: 'utf8'
            });
            
            const duration = Date.now() - startTime;
            logger.info(`ASA baseline collected (${Math.round(duration / 1000)}s)`);
            
            this.activeCollections.set(taskName, {
                baselineId,
                startTime: Date.now()
            });
            
        } catch (error) {
            const duration = Date.now() - startTime;
            this.handleError(error, 'ASA baseline collection', taskName, duration);
        }
    }

    /**
     * Collect post-build state and generate report
     * @param {string} taskName - Name of task to collect post-build state for
     * @returns {Promise<void>}
     */
    async collectPostBuild(taskName) {
        const collection = this.activeCollections.get(taskName);
        if (!collection) {
            logger.debug(`No baseline collection found for ${taskName}, skipping post-build`);
            return;
        }

        logger.info(`ASA post-build: ${taskName}`);
        const startTime = Date.now();
        
        try {
            const postBuildId = `${this.collectionId}-${taskName}${ASA_CONSTANTS.POSTBUILD_SUFFIX}`;
            const command = this.buildCommand(postBuildId, taskName);

            ncp.execSync(command, { 
                stdio: 'pipe',
                timeout: this.config.timeout,
                encoding: 'utf8'
            });
            
            // Generate security report
            await this.generateReport(taskName, collection.baselineId, postBuildId);
            
            const duration = Date.now() - startTime;
            logger.info(`ASA analysis complete (${Math.round(duration / 1000)}s)`);
            
        } catch (error) {
            const duration = Date.now() - startTime;
            this.handleError(error, 'ASA post-build collection', taskName, duration);
        } finally {
            this.activeCollections.delete(taskName);
        }
    }

    /**
     * Generate security report
     * @param {string} taskName - Task name
     * @param {string} baselineId - Baseline collection ID
     * @param {string} postBuildId - Post-build collection ID
     * @returns {Promise<void>}
     */
    async generateReport(taskName, baselineId, postBuildId) {
        const startTime = Date.now();
        
        try {
            const exportCommand = [
                `"${this.asaExecutable}"`,
                'export-collect',
                '--firstrunid', `"${baselineId}"`,
                '--secondrunid', `"${postBuildId}"`,
                '--outputpath', `"${asaReportsPath}"`,
                '--outputsarif',
                '--quiet'
            ].join(' ');

            logger.debug(`Generating ASA report: ${exportCommand}`);

            ncp.execSync(exportCommand, { 
                stdio: 'pipe',
                timeout: this.config.reportTimeout,
                encoding: 'utf8'
            });

            // Quick analysis
            const sarifFile = path.join(asaReportsPath, 'results.sarif');
            if (test('-f', sarifFile)) {
                this.quickAnalyze(taskName, sarifFile);
                
                // Rename to task-specific name
                const taskSarifFile = path.join(asaReportsPath, `${taskName}-security-report.sarif`);
                fs.renameSync(sarifFile, taskSarifFile);
                logger.info(`ASA report saved: ${taskSarifFile}`);
            } else {
                logger.warn('ASA report file not found after export');
            }
            
        } catch (error) {
            const duration = Date.now() - startTime;
            this.handleError(error, 'ASA report generation', taskName, duration);
        }
    }

    /**
     * Quick analysis of results with enhanced metrics
     * @param {string} taskName - Task name
     * @param {string} sarifFile - Path to SARIF file
     */
    quickAnalyze(taskName, sarifFile) {
        try {
            const sarifData = JSON.parse(fs.readFileSync(sarifFile, 'utf8'));
            let totalFindings = 0;
            let ruleCount = 0;
            let criticalFindings = 0;
            
            (sarifData.runs || []).forEach(run => {
                const results = run.results || [];
                totalFindings += results.length;
                ruleCount += (run.tool?.driver?.rules || []).length;
                
                // Count critical findings
                criticalFindings += results.filter(result => 
                    result.level === 'error' || result.properties?.['security-severity'] === 'critical'
                ).length;
            });
            
            const context = { taskName, totalFindings, ruleCount, criticalFindings };
            
            if (totalFindings === 0) {
                logger.info(`No security issues found for ${taskName} (${ruleCount} rules checked)`, context);
            } else {
                const level = criticalFindings > 0 ? 'error' : 'warn';
                logger[level](`Found ${totalFindings} security findings for ${taskName} (${criticalFindings} critical, ${ruleCount} rules checked)`, context);
            }
            
        } catch (error) {
            logger.debug(`Failed to analyze SARIF file: ${error.message}`);
        }
    }

    /**
     * Cleanup old collections
     * @returns {Promise<void>}
     */
    async cleanup() {
        if (!this.enabled || !this.asaExecutable) {
            return;
        }

        try {
            const keepCount = this.config.keepCollections;
            const cleanupCommand = [
                `"${this.asaExecutable}"`,
                'config',
                '--trim-to-latest', keepCount.toString()
            ].join(' ');

            logger.debug(`ASA cleanup command: ${cleanupCommand}`);
            ncp.execSync(cleanupCommand, { 
                stdio: 'pipe', 
                timeout: ASA_CONSTANTS.DEFAULT_CLEANUP_TIMEOUT 
            });
            logger.info(`ASA cleanup completed (keeping ${keepCount} collections)`);
            
        } catch (error) {
            logger.debug(`ASA cleanup failed (non-critical): ${error.message.split('\n')[0]}`);
        }
    }
}

// Export singleton instance
const asaAnalyzer = new ASAAnalyzer();

module.exports = {
    collectBaseline: (taskName) => asaAnalyzer.collectBaseline(taskName),
    collectPostBuild: (taskName) => asaAnalyzer.collectPostBuild(taskName),
    cleanup: () => asaAnalyzer.cleanup(),
    isEnabled: () => asaAnalyzer.enabled
};