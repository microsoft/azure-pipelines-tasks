import Q = require('q');
import path = require('path');
import fs = require('fs');
import task = require('./task');
import tcm = require('./taskcommand');
import trm = require('./mock-toolrunner');
import ma = require('./mock-answer');

let mock: ma.MockAnswers = new ma.MockAnswers();

export function setAnswers(answers: ma.TaskLibAnswers) {
    mock.initialize(answers);
    trm.setAnswers(answers);
}

//-----------------------------------------------------
// Enums
//-----------------------------------------------------

module.exports.TaskResult = task.TaskResult;
module.exports.TaskState = task.TaskState;
module.exports.IssueType = task.IssueType;
module.exports.ArtifactType = task.ArtifactType;
module.exports.FieldType = task.FieldType;
module.exports.Platform = task.Platform;

//-----------------------------------------------------
// Results and Exiting
//-----------------------------------------------------

module.exports.setStdStream = task.setStdStream;
module.exports.setErrStream = task.setErrStream;
module.exports.setResult = task.setResult;
module.exports.setSanitizedResult = task.setSanitizedResult;

//-----------------------------------------------------
// Loc Helpers
//-----------------------------------------------------
export function setResourcePath(path: string): void {
    // nothing in mock
}

export function loc(key: string, ...args: any[]): string {
    let str: string = 'loc_mock_' + key;
    if (args.length) {
        str += ' ' + args.join(' ');
    }

    return str;
}

//-----------------------------------------------------
// Input Helpers
//-----------------------------------------------------
module.exports.assertAgent = task.assertAgent;
module.exports.getVariable = task.getVariable;
module.exports.getVariables = task.getVariables;
module.exports.setVariable = task.setVariable;
module.exports.setSecret = task.setSecret;
module.exports.getTaskVariable = task.getTaskVariable;
module.exports.setTaskVariable = task.setTaskVariable;
module.exports.getInput = task.getInput;
module.exports.getInputRequired = task.getInputRequired;
module.exports.getBoolInput = task.getBoolInput;
module.exports.getBoolFeatureFlag = task.getBoolFeatureFlag;
module.exports.getPipelineFeature = task.getPipelineFeature;
module.exports.getDelimitedInput = task.getDelimitedInput;
module.exports.filePathSupplied = task.filePathSupplied;

function getPathInput(name: string, required?: boolean, check?: boolean): string {
    var inval = module.exports.getInput(name, required);
    if (inval) {
        if (check) {
            checkPath(inval, name);
        }
    }
    return inval;
}
module.exports.getPathInput = getPathInput;

function getPathInputRequired(name: string, check?: boolean): string {
    return getPathInput(name, true, check)!;
}
module.exports.getPathInputRequired = getPathInputRequired;

//-----------------------------------------------------
// Endpoint Helpers
//-----------------------------------------------------
module.exports.getEndpointUrl = task.getEndpointUrl;
module.exports.getEndpointUrlRequired = task.getEndpointUrlRequired;
module.exports.getEndpointDataParameter = task.getEndpointDataParameter;
module.exports.getEndpointDataParameterRequired = task.getEndpointDataParameterRequired;
module.exports.getEndpointAuthorizationScheme = task.getEndpointAuthorizationScheme;
module.exports.getEndpointAuthorizationSchemeRequired = task.getEndpointAuthorizationSchemeRequired;
module.exports.getEndpointAuthorizationParameter = task.getEndpointAuthorizationParameter;
module.exports.getEndpointAuthorizationParameterRequired = task.getEndpointAuthorizationParameterRequired;
module.exports.getEndpointAuthorization = task.getEndpointAuthorization;

// TODO: should go away when task lib
export interface EndpointAuthorization {
    parameters: {
        [key: string]: string;
    };
    scheme: string;
}

//-----------------------------------------------------
// SecureFile Helpers
//-----------------------------------------------------
module.exports.getSecureFileName = task.getSecureFileName;
module.exports.getSecureFileTicket = task.getSecureFileTicket;

//-----------------------------------------------------
// Fs Helpers
//-----------------------------------------------------

export class FsStats implements fs.Stats {
    private m_isFile: boolean = false;
    private m_isDirectory: boolean = false;
    private m_isBlockDevice: boolean = false;
    private m_isCharacterDevice: boolean = false;
    private m_isSymbolicLink: boolean = false;
    private m_isFIFO: boolean = false;
    private m_isSocket: boolean = false;

    dev: number = 0;
    ino: number = 0;
    mode: number = 0;
    nlink: number = 0;
    uid: number = 0;
    gid: number = 0;
    rdev: number = 0;
    size: number = 0;
    blksize: number = 0;
    blocks: number = 0;
    atime: Date = new Date();
    mtime: Date = new Date();
    ctime: Date = new Date();
    birthtime: Date = new Date();
    atimeMs: number;
    mtimeMs: number;
    ctimeMs: number;
    birthtimeMs: number;

    setAnswers(mockResponses: any): void {
        this.m_isFile = mockResponses['isFile'] || this.m_isFile;
        this.m_isDirectory = mockResponses['isDirectory'] || this.m_isDirectory;
        this.m_isBlockDevice = mockResponses['isBlockDevice'] || this.m_isBlockDevice;
        this.m_isCharacterDevice = mockResponses['isCharacterDevice'] || this.m_isCharacterDevice;
        this.m_isSymbolicLink = mockResponses['isSymbolicLink'] || this.m_isSymbolicLink;
        this.m_isFIFO = mockResponses['isFIFO'] || this.m_isFIFO;
        this.m_isSocket = mockResponses['isSocket'] || this.m_isSocket;

        this.dev = mockResponses['dev'] || this.dev;
        this.ino = mockResponses['ino'] || this.ino;
        this.mode = mockResponses['mode'] || this.mode;
        this.nlink = mockResponses['nlink'] || this.nlink;
        this.uid = mockResponses['uid'] || this.uid;
        this.gid = mockResponses['gid'] || this.gid;
        this.rdev = mockResponses['rdev'] || this.rdev;
        this.size = mockResponses['size'] || this.size;
        this.blksize = mockResponses['blksize'] || this.blksize;
        this.blocks = mockResponses['blocks'] || this.blocks;
        this.atime = mockResponses['atime'] || this.atime;
        this.mtime = mockResponses['mtime'] || this.mtime;
        this.ctime = mockResponses['ctime'] || this.ctime;
        this.m_isSocket = mockResponses['isSocket'] || this.m_isSocket;
    }

    isFile(): boolean {
        return this.m_isFile;
    }

    isDirectory(): boolean {
        return this.m_isDirectory;
    }

    isBlockDevice(): boolean {
        return this.m_isBlockDevice;
    }

    isCharacterDevice(): boolean {
        return this.m_isCharacterDevice;
    }

    isSymbolicLink(): boolean {
        return this.m_isSymbolicLink;
    }

    isFIFO(): boolean {
        return this.m_isFIFO;
    }

    isSocket(): boolean {
        return this.m_isSocket;
    }
}

export function stats(path: string): FsStats {
    var fsStats = new FsStats();
    fsStats.setAnswers(mock.getResponse('stats', path, module.exports.debug) || {});
    return fsStats;
}

export function exist(path: string): boolean {
    return mock.getResponse('exist', path, module.exports.debug) || false;
}

export interface FsOptions {
    encoding?:string;
    mode?:number;
    flag?:string;
}

export function writeFile(file: string, data: string|Buffer, options?: string|FsOptions) {
    //do nothing
}

export function osType(): string {
    return mock.getResponse('osType', 'osType', module.exports.debug);
}

export function getPlatform(): task.Platform {
    return mock.getResponse('getPlatform', 'getPlatform', module.exports.debug);
}

export function getNodeMajorVersion(): Number {
    return mock.getResponse('getNodeMajorVersion', 'getNodeMajorVersion', module.exports.debug);
}

export function getAgentMode(): task.AgentHostedMode {
    return mock.getResponse('getAgentMode', 'getAgentMode', module.exports.debug);
}

export function cwd(): string {
    return mock.getResponse('cwd', 'cwd', module.exports.debug);
}

//-----------------------------------------------------
// Cmd Helpers
//-----------------------------------------------------
module.exports.command = task.command;
module.exports.warning = task.warning;
module.exports.error = task.error;
module.exports.debug = task.debug;

export function cd(path: string): void {
    // do nothing.  TODO: keep stack with asserts
}

export function pushd(path: string): void {
    // do nothing.  TODO: keep stack with asserts
}

export function popd(): void {
    // do nothing.  TODO: keep stack with asserts
}

//------------------------------------------------
// Validation Helpers
//------------------------------------------------

export function checkPath(p: string, name: string): void {
    module.exports.debug('check path : ' + p);
    if (!p || !mock.getResponse('checkPath', p, module.exports.debug)) {
        throw new Error('Not found ' + p);
    }
}

//-----------------------------------------------------
// Shell/File I/O Helpers
// Abstract these away so we can
// - default to good error handling
// - inject system.debug info
// - have option to switch internal impl (shelljs now)
//-----------------------------------------------------
export function mkdirP(p): void {
    module.exports.debug('creating path: ' + p);
}

export function resolve(): string {
    // we can't do ...param if we target ES6 and node 5.  This is what <=ES5 compiles down to.
    //return the posix implementation in the mock, so paths will be consistent when L0 tests are run on Windows or Mac/Linux
    var absolutePath = path.posix.resolve.apply(this, arguments);
    module.exports.debug('Absolute path for pathSegments: ' + arguments + ' = ' + absolutePath);
    return absolutePath;
}

export function which(tool: string, check?: boolean): string {
    var response = mock.getResponse('which', tool, module.exports.debug);
    if (check) {
        checkPath(response, tool);
    }
    return response;
}

export function ls(options: string, paths: string[]): string[] {
    var response = mock.getResponse('ls', paths[0], module.exports.debug);
    if(!response){
        return [];
    }
    return response;
}

export function cp(source: string, dest: string): void {
    module.exports.debug('###copying###');
    module.exports.debug('copying ' + source + ' to ' + dest);
}

export function retry(func: Function, args: any[], retryOptions: task.RetryOptions): any {
    module.exports.debug(`trying to execute ${func?.name}(${args.toString()}) with ${retryOptions.retryCount} retries`);
}

export function find(findPath: string): string[] {
    return mock.getResponse('find', findPath, module.exports.debug);
}

export function rmRF(path: string): void {
    module.exports.debug('rmRF ' + path);
    var response = mock.getResponse('rmRF', path, module.exports.debug);
    if (!response['success']) {
        module.exports.setResult(1, response['message']);
    }
}

export function mv(source: string, dest: string, force: boolean, continueOnError?: boolean): boolean {
    module.exports.debug('moving ' + source + ' to ' + dest);
    return true;
}

//-----------------------------------------------------
// Exec convenience wrapper
//-----------------------------------------------------
export function exec(tool: string, args: any, options?: trm.IExecOptions): Q.Promise<number> {
    var toolPath = which(tool, true);
    var tr: trm.ToolRunner = this.tool(toolPath);
    if (args) {
        tr.arg(args);
    }
    return tr.exec(options);
}

//-----------------------------------------------------
// Exec convenience wrapper
//-----------------------------------------------------
export function execAsync(tool: string, args: any, options?: trm.IExecOptions): Promise<number> {
    var toolPath = which(tool, true);
    var tr: trm.ToolRunner = this.tool(toolPath);
    if (args) {
        tr.arg(args);
    }
    return tr.execAsync(options);
}

export function execSync(tool: string, args: any, options?: trm.IExecSyncOptions): trm.IExecSyncResult {
    var toolPath = which(tool, true);
    var tr: trm.ToolRunner = this.tool(toolPath);
    if (args) {
        tr.arg(args);
    }

    return tr.execSync(options);
}

export function tool(tool: string): trm.ToolRunner {
    var tr: trm.ToolRunner = new trm.ToolRunner(tool);
    tr.on('debug', (message: string) => {
        module.exports.debug(message);
    })

    return tr;
}

//-----------------------------------------------------
// Matching helpers
//-----------------------------------------------------
module.exports.filter = task.filter;
module.exports.match = task.match;

// redefine to avoid folks having to typings install minimatch
export interface MatchOptions {
    debug?: boolean;
    nobrace?: boolean;
    noglobstar?: boolean;
    dot?: boolean;
    noext?: boolean;
    nocase?: boolean;
    nonull?: boolean;
    matchBase?: boolean;
    nocomment?: boolean;
    nonegate?: boolean;
    flipNegate?: boolean;
}

export function findMatch(defaultRoot: string, patterns: string[] | string) : string[] {
    let responseKey: string = typeof patterns == 'object' ? (patterns as string[]).join('\n') : patterns as string;
    return mock.getResponse('findMatch', responseKey, module.exports.debug);
}

export function legacyFindFiles(rootDirectory: string, pattern: string, includeFiles?: boolean, includeDirectories?: boolean) : string[] {
    return mock.getResponse('legacyFindFiles', pattern, module.exports.debug);
}

//-----------------------------------------------------
// Test Publisher
//-----------------------------------------------------
export class TestPublisher {
    constructor(public testRunner: string) {
    }

    public publish(resultFiles?: string, mergeResults?: string, platform?: string, config?: string, runTitle?: string, publishRunAttachments?: string) {

        var properties = <{ [key: string]: string }>{};
        properties['type'] = this.testRunner;

        if (mergeResults) {
            properties['mergeResults'] = mergeResults;
        }

        if (platform) {
            properties['platform'] = platform;
        }

        if (config) {
            properties['config'] = config;
        }

        if (runTitle) {
            properties['runTitle'] = runTitle;
        }

        if (publishRunAttachments) {
            properties['publishRunAttachments'] = publishRunAttachments;
        }

        if (resultFiles) {
            properties['resultFiles'] = resultFiles;
        }

        module.exports.command('results.publish', properties, '');
    }
}

//-----------------------------------------------------
// Code Coverage Publisher
//-----------------------------------------------------
export class CodeCoveragePublisher {
    constructor() {
    }
    public publish(codeCoverageTool?: string, summaryFileLocation?: string, reportDirectory?: string, additionalCodeCoverageFiles?: string) {

        var properties = <{ [key: string]: string }>{};

        if (codeCoverageTool) {
            properties['codecoveragetool'] = codeCoverageTool;
        }

        if (summaryFileLocation) {
            properties['summaryfile'] = summaryFileLocation;
        }

        if (reportDirectory) {
            properties['reportdirectory'] = reportDirectory;
        }

        if (additionalCodeCoverageFiles) {
            properties['additionalcodecoveragefiles'] = additionalCodeCoverageFiles;
        }

        module.exports.command('codecoverage.publish', properties, "");
    }
}

//-----------------------------------------------------
// Code coverage Publisher
//-----------------------------------------------------
export class CodeCoverageEnabler {
    private buildTool: string;
    private ccTool: string;

    constructor(buildTool: string, ccTool: string) {
        this.buildTool = buildTool;
        this.ccTool = ccTool;
    }

    public enableCodeCoverage(buildProps: { [key: string]: string }) {
        buildProps['buildtool'] = this.buildTool;
        buildProps['codecoveragetool'] = this.ccTool;
        module.exports.command('codecoverage.enable', buildProps, "");
    }
}

//-----------------------------------------------------
// Task Logging Commands
//-----------------------------------------------------
exports.uploadFile = task.uploadFile;
exports.prependPath = task.prependPath;
exports.uploadSummary = task.uploadSummary;
exports.addAttachment = task.addAttachment;
exports.setEndpoint = task.setEndpoint;
exports.setProgress = task.setProgress;
exports.logDetail = task.logDetail;
exports.logIssue = task.logIssue;

//-----------------------------------------------------
// Artifact Logging Commands
//-----------------------------------------------------
exports.uploadArtifact = task.uploadArtifact;
exports.associateArtifact = task.associateArtifact;

//-----------------------------------------------------
// Build Logging Commands
//-----------------------------------------------------
exports.uploadBuildLog = task.uploadBuildLog;
exports.updateBuildNumber = task.updateBuildNumber;
exports.addBuildTag = task.addBuildTag;

//-----------------------------------------------------
// Release Logging Commands
//-----------------------------------------------------
exports.updateReleaseName = task.updateReleaseName;

//-----------------------------------------------------
// Tools
//-----------------------------------------------------
exports.TaskCommand = tcm.TaskCommand;
exports.commandFromString = tcm.commandFromString;
exports.ToolRunner = trm.ToolRunner;

//-----------------------------------------------------
// Http Proxy Helper
//-----------------------------------------------------
export function getHttpProxyConfiguration(requestUrl?: string): task.ProxyConfiguration | null {
    return null;
}

//-----------------------------------------------------
// Http Certificate Helper
//-----------------------------------------------------
export function getHttpCertConfiguration(): task.CertConfiguration | null {
    return null
}