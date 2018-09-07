"use strict";

import * as path from "path";
import * as util from "util";
import * as tl from "vsts-task-lib/task";
import * as tr from "vsts-task-lib/toolrunner";
import * as utils from "./utilities";
import * as constants from "./constants";
import * as definitions from "./definitions"
import TaskParameters from "./taskParameters"


export default class PackerHost implements definitions.IPackerHost {

    constructor() {
        this._templateFileProviders = {};
        this._templateVariablesProviders = {};
        this._taskParameters = new TaskParameters();
    }

    public async initialize() {
        this._packerPath = await this._getPackerPath();
        tl.debug("Packer path to be used by task: " + this._packerPath);
    }

    // Will create and return packer toolrunner
    public createPackerTool(): tr.ToolRunner {
        var command = tl.tool(this._packerPath);
        return command;
    }

    // Creates packer toolrunner with options
    // Also sets up parser which will parse output log on the fly
    public execTool(command: tr.ToolRunner, outputParser?: definitions.IOutputParser): Q.Promise<any> {
        var outputExtractorFunc = null;
        if(!!outputParser) {
            outputExtractorFunc = (line: string) => {
                outputParser.parse(line);
            }
        }

        var options = <any>{
            outStream: new utils.StringWritable({ decodeStrings: false }, outputExtractorFunc),
            errStream: new utils.StringWritable({ decodeStrings: false })
        };

        return command.exec(options);
    }

    public getTaskParameters(): TaskParameters {
        return this._taskParameters;
    }

    public getStagingDirectory(): string {
        if(!!this._stagingDirectory) {
            return this._stagingDirectory;
        }

        this._stagingDirectory = path.join(utils.getTempDirectory(), utils.getCurrentTime().toString());
        if(!tl.exist(this._stagingDirectory)) {
            tl.mkdirP(this._stagingDirectory);    
        }

        console.log(tl.loc("CreatedStagingDirectory", this._stagingDirectory));
        return this._stagingDirectory;
    }

    public getTemplateFileProvider(): definitions.ITemplateFileProvider {
        if(this._taskParameters.templateType === constants.TemplateTypeCustom) {
            return this._templateFileProviders[definitions.TemplateFileProviderTypes.Custom];
        } else {
            return this._templateFileProviders[definitions.TemplateFileProviderTypes.BuiltIn];
        }
    }

    public getTemplateVariablesProviders(): definitions.ITemplateVariablesProvider[] {
        var taskInputTemplateVariablesProvider = this._templateVariablesProviders[definitions.VariablesProviderTypes.TaskInput];
        var azureSpnTemplateVariablesProvider = this._templateVariablesProviders[definitions.VariablesProviderTypes.AzureSPN];
        
        return [taskInputTemplateVariablesProvider, azureSpnTemplateVariablesProvider];
    }

    public registerTemplateFileProvider(providerType: definitions.TemplateFileProviderTypes, provider: definitions.ITemplateFileProvider) {
        this._templateFileProviders[providerType] = provider;
    }

    public registerTemplateVariablesProvider(providerType: definitions.VariablesProviderTypes, provider: definitions.ITemplateVariablesProvider) {
        this._templateVariablesProviders[providerType] = provider;
    }

    public cleanup(): void {
        try{
            utils.deleteDirectory(this._stagingDirectory);
        }
        catch (err) {
            tl.warning(tl.loc("CouldNotDeleteStagingDirectory", this._stagingDirectory));
        }
    }

    private async _getPackerPath(): Promise<string> {
        var installedPackerPath = tl.which("packer", false);
        var installedPackerVersion = this._getPackerVersion(installedPackerPath);
        console.log(tl.loc("InstalledPackerVersion", installedPackerVersion));
        if(!installedPackerVersion || 
            utils.isGreaterVersion(utils.PackerVersion.convertFromString(constants.CurrentSupportedPackerVersionString), utils.PackerVersion.convertFromString(installedPackerVersion))) {

            console.log(tl.loc("DownloadingPackerRequired", constants.CurrentSupportedPackerVersionString, constants.CurrentSupportedPackerVersionString));
            var downloadPath = path.join(this.getStagingDirectory(), "packer.zip");
            var packerDownloadUrl = util.format(constants.PackerDownloadUrlFormat, constants.CurrentSupportedPackerVersionString, constants.CurrentSupportedPackerVersionString, this._getPackerZipNamePrefix());
            tl.debug("Downloading packer from url: " + packerDownloadUrl);
            await utils.download(packerDownloadUrl, downloadPath);
            console.log(tl.loc("DownloadingPackerCompleted", downloadPath));
            
            var extractedPackerLocation = path.join(this.getStagingDirectory(), "packer");
            await utils.unzip(downloadPath, extractedPackerLocation);
            if(tl.osType().match(/^Win/)) {
                var packerPath = path.join(extractedPackerLocation, "packer.exe");
            } else {
                var packerPath = path.join(extractedPackerLocation, "packer");
            }

            console.log(tl.loc("ExtractingPackerCompleted", packerPath));
            await this._waitForPackerExecutable(packerPath);         
            return packerPath;
        } else {
            return installedPackerPath;
        }
    }

    private _getPackerVersion(packerPath: string): string {
        if(!!packerPath && tl.exist(packerPath)) {
            // if failed to get version, do not fail task
            try {
                return tl.tool(packerPath).arg("--version").execSync().stdout.trim();
            } catch (err) {}
        }

        return null;
    }

    private async _waitForPackerExecutable(packerPath: string): Promise<void> {
        if(!!packerPath && tl.exist(packerPath)) {
            var iterationCount = 0;
            do{
                // query version to check if packer executable is ready
                var result = tl.tool(packerPath).arg("--version").execSync();
                if(result.code != 0 && result.error && result.error.message.indexOf("EBUSY") != -1){
                    iterationCount++;
                    console.log(tl.loc("PackerToolBusy"));
                    await utils.sleep(1000);
                } else {
                    break;
                }
            } while (iterationCount <= 10)
        }
    }

    private _getPackerZipNamePrefix(): string {
        if(tl.osType().match(/^Win/)) {
            return 'windows_amd64';
        } else if(tl.osType().match(/^Linux/)) {
            return 'linux_amd64';
        } else if(tl.osType().match(/^Darwin/)) {
            return 'darwin_amd64';
        }

        throw tl.loc("OSNotSupportedForRunningPacker");
    }

    private _packerPath: string;
    private _taskParameters: TaskParameters;
    private _stagingDirectory: string;
    private _templateFileProviders: ObjectDictionary<definitions.ITemplateFileProvider>;
    private _templateVariablesProviders: ObjectDictionary<definitions.ITemplateVariablesProvider>;
}

interface ObjectDictionary<T> { [key: number]: T; }