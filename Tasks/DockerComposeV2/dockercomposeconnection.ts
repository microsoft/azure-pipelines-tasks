"use strict";

import * as del from "del";
import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";
import * as tr from "azure-pipelines-task-lib/toolrunner";
import * as yaml from "js-yaml";
import * as DockerComposeUtils from "./dockercomposeutils";

import ContainerConnection from "azure-pipelines-tasks-docker-common-v2/containerconnection"
import AuthenticationToken from "azure-pipelines-tasks-docker-common-v2/registryauthenticationprovider/registryauthenticationtoken"
import * as Utils from "./utils";

export default class DockerComposeConnection extends ContainerConnection {
    private dockerComposeFile: string;
    private dockerComposeVersion: string;
    private additionalDockerComposeFiles: string[];
    private requireAdditionalDockerComposeFiles: boolean;
    private projectName: string;
    private finalComposeFile: string;

    constructor() {
        super();
        this.dockerComposeFile = DockerComposeUtils.findDockerFile(tl.getInput("dockerComposeFile", true), tl.getInput("cwd"));
        if (!this.dockerComposeFile) {
            throw new Error("No Docker Compose file matching " + tl.getInput("dockerComposeFile") + " was found.");
        }
        this.dockerComposeVersion = "2";
        this.additionalDockerComposeFiles = tl.getDelimitedInput("additionalDockerComposeFiles", "\n");
        this.requireAdditionalDockerComposeFiles = tl.getBoolInput("requireAdditionalDockerComposeFiles");
        this.projectName = tl.getInput("projectName");
    }

    public open(hostEndpoint?: string, authenticationToken?: AuthenticationToken): any {
        super.open(hostEndpoint, authenticationToken);

        if (this.hostUrl) {
            process.env["DOCKER_HOST"] = this.hostUrl;
            process.env["DOCKER_TLS_VERIFY"] = "1";
            process.env["DOCKER_CERT_PATH"] = this.certsDir;
        }

        tl.getDelimitedInput("dockerComposeFileArgs", "\n").forEach(envVar => {
            var tokens = envVar.split("=");
            if (tokens.length < 2) {
                throw new Error("Environment variable '" + envVar + "' is invalid.");
            }
            process.env[tokens[0].trim()] = tokens.slice(1).join("=").trim();
        });

        return this.getImages(true).then(images => {
            var qualifyImageNames = tl.getBoolInput("qualifyImageNames");
            if (!qualifyImageNames) {
                return;
            }
            var agentDirectory = tl.getVariable("Agent.HomeDirectory");
            this.finalComposeFile = path.join(agentDirectory, Utils.getFinalComposeFileName());
            var services = {};
            if (qualifyImageNames) {
                for (var serviceName in images) {
                    images[serviceName] = this.getQualifiedImageNameIfRequired(images[serviceName]);
                }
            }
            for (var serviceName in images) {
                services[serviceName] = {
                    image: images[serviceName]
                };
            }
            Utils.writeFileSync(this.finalComposeFile, yaml.safeDump({
                version: this.dockerComposeVersion,
                services: services
            }, { lineWidth: -1 } as any));
        });
    }

    public async execCommandWithLogging(command: tr.ToolRunner, options?: tr.IExecOptions): Promise<string> {
        // setup variable to store the command output
        let output = "";
        command.on("stdout", data => {
            output += data;
        });

        command.on("stderr", data => {
            output += data;
        });

        await this.execCommand(command, options);

        return output || '\n';
    }

    public createComposeCommand(): tr.ToolRunner {
        var command = this.createCommand();
        command.arg(["compose", "-f", this.dockerComposeFile]);
        var basePath = path.dirname(this.dockerComposeFile);
        this.additionalDockerComposeFiles.forEach(file => {
            file = this.resolveAdditionalDockerComposeFilePath(basePath, file);
            if (this.requireAdditionalDockerComposeFiles || tl.exist(file)) {
                command.arg(["-f", file]);
            }
        });
        if (this.finalComposeFile) {
            command.arg(["-f", this.finalComposeFile]);
        }

        if (this.projectName) {
            command.arg(["-p", this.projectName]);
        }
        return command;
    }

    public getCombinedConfig(imageDigestComposeFile?: string): any {
        var command = this.createComposeCommand();
        if (imageDigestComposeFile) {
            command.arg(["-f", imageDigestComposeFile]);
        }
        command.arg("config");
        var result = "";
        command.on("stdout", data => {
            result += data;
        });
        command.on("errline", line => {
            tl.error(line);
        });
        return command.exec({ silent: true } as any).then(() => result);
    }

    public getImages(builtOnly?: boolean): any {
        return this.getCombinedConfig().then(input => {
            var doc = yaml.safeLoad(input);
            if (doc.version) {
                this.dockerComposeVersion = doc.version;
            }
            var projectName = this.projectName;
            if (!projectName) {
                projectName = path.basename(path.dirname(this.dockerComposeFile));
            }
            var images: any = {};
            for (var serviceName in doc.services || {}) {
                var service = doc.services[serviceName];
                var image = service.image;
                if (!image) {
                    image = projectName.toLowerCase().replace(/[^0-9a-z]/g, "") + "_" + serviceName;
                }
                if (!builtOnly || service.build) {
                    images[serviceName] = image;
                }
            }
            return images;
        });
    }

    public getVersion(): string {
        return this.dockerComposeVersion;
    }

    public close(): void {
        if (this.finalComposeFile && tl.exist(this.finalComposeFile)) {
            del.sync(this.finalComposeFile, { force: true });
        }
        super.close();
    }

    private resolveAdditionalDockerComposeFilePath(dockerComposeFolderPath: string, additionalComposeFilePath: string): string {
        if (!path.isAbsolute(additionalComposeFilePath)) {
            additionalComposeFilePath = path.join(dockerComposeFolderPath, additionalComposeFilePath);
        }

        if (!tl.exist(additionalComposeFilePath)) {
            tl.warning(tl.loc('AdditionalDockerComposeFileDoesNotExists', additionalComposeFilePath));
        }

        return additionalComposeFilePath;
    }
}
