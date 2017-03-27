"use strict";

import * as del from "del";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import * as tl from "vsts-task-lib/task";
import * as tr from "vsts-task-lib/toolrunner";
import * as imageUtils from "./dockerImageUtils";

export default class DockerConnection {
    private dockerPath: string;
    protected hostUrl: string;
    protected certsDir: string;
    private caPath: string;
    private certPath: string;
    private keyPath: string;
    private registryAuth: { [key: string]: string };
    private registryHost: string;

    constructor() {
        this.dockerPath = tl.which("docker", true);
    }

    public createCommand(): tr.ToolRunner {
        var command = tl.tool(this.dockerPath);
        if (this.hostUrl) {
            command.arg(["-H", this.hostUrl]);
            command.arg("--tls");
            command.arg("--tlscacert='" + this.caPath + "'");
            command.arg("--tlscert='" + this.certPath + "'");
            command.arg("--tlskey='" + this.keyPath + "'");
        }
        return command;
    }

    public execCommand(command: tr.ToolRunner, options?: tr.IExecOptions) {
        var errlines = [];
        command.on("errline", line => {
            errlines.push(line);
        });
        return command.exec(options).fail(error => {
            errlines.forEach(line => tl.error(line));
            throw error;
        });
    }

    public open(hostEndpoint?: string, registryEndpoint?: string): void {
        if (hostEndpoint) {
            this.hostUrl = tl.getEndpointUrl(hostEndpoint, false);
            if (this.hostUrl.charAt(this.hostUrl.length - 1) == "/") {
                this.hostUrl = this.hostUrl.substring(0, this.hostUrl.length - 1);
            }

            this.certsDir = path.join("", ".dockercerts");
            if (!fs.existsSync(this.certsDir)) {
                fs.mkdirSync(this.certsDir);
            }

            var authDetails = tl.getEndpointAuthorization(hostEndpoint, false).parameters;

            this.caPath = path.join(this.certsDir, "ca.pem");
            fs.writeFileSync(this.caPath, authDetails["cacert"]);

            this.certPath = path.join(this.certsDir, "cert.pem");
            fs.writeFileSync(this.certPath, authDetails["cert"]);

            this.keyPath = path.join(this.certsDir, "key.pem");
            fs.writeFileSync(this.keyPath, authDetails["key"]);
        }

        if (registryEndpoint) {
            var command = this.createCommand();
            this.registryAuth = tl.getEndpointAuthorization(registryEndpoint, true).parameters;
            if (this.registryAuth) {
                command.arg("login");
                command.arg(["-u", this.registryAuth["username"]]);
                command.arg(["-p", this.registryAuth["password"]]);
                command.arg(this.registryAuth["registry"]);
                command.execSync();
                this.registryHost = this.registryAuth["registry"];
            }
        }
    }

    public qualifyImageName(imageName: string) {
        if (!imageUtils.hasRegistryComponent(imageName) && this.registryAuth) {
            var regUrl = url.parse(this.registryAuth["registry"]),
                hostname = !regUrl.slashes ? regUrl.href : regUrl.host;
            if (hostname.toLowerCase() !== "index.docker.io") {
                imageName = hostname + "/" + imageName;
            }
        }
        return imageName;
    }

    public close(): void {
        if (this.registryHost) {
            var command = this.createCommand();
            command.arg("logout");
            command.arg(this.registryHost);
            command.execSync();
        }
        if (this.certsDir && fs.existsSync(this.certsDir)) {
            del.sync(this.certsDir);
        }
    }
}
