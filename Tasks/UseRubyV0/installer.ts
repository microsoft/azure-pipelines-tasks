import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import * as task from "azure-pipelines-task-lib/task";
import * as tool from "azure-pipelines-tool-lib/tool"

enum Platform {
    Windows,
    MacOS,
    Linux
}

function getPlatform(): Platform {
    switch (process.platform) {
        case "win32": return Platform.Windows;
        case "darwin": return Platform.MacOS;
        case "linux": return Platform.Linux;
        default: throw Error(task.loc("PlatformNotRecognized"));
    }
}

interface TaskParameters {
    readonly version: string;
    readonly architecture: string;
}

export async function installRubyVersion(parameters: TaskParameters): Promise<void> {
    const toolName: string = "Ruby";
    const installDir: string | null = tool.findLocalTool(toolName, parameters.version, parameters.architecture);
    if (!installDir) {
        // Fail and list available versions
        throw new Error([
            task.loc("VersionNotFound", parameters.version),
            task.loc("ListAvailableVersions", task.getVariable("Agent.ToolsDirectory")),
            tool.findLocalToolVersions("Ruby"),
            task.loc("ToolNotFoundMicrosoftHosted", "Ruby", "https://aka.ms/hosted-agent-software"),
            task.loc("ToolNotFoundSelfHosted", "Ruby", "https://go.microsoft.com/fwlink/?linkid=2005989")
        ].join(os.EOL));
    }

    const toolPath: string = path.join(installDir, "bin");
    const platform = getPlatform();
    if (platform !== Platform.Windows) {
        // Ruby / Gem heavily use the "#!/usr/bin/ruby" to find ruby, so this task needs to
        // replace that version of ruby so all the correct version of ruby gets selected
        // replace the default
        const dest: string = "/usr/bin/ruby";
        task.execSync("sudo", `ln -sf ${path.join(toolPath, "ruby")} ${dest}`); // replace any existing
    }

    task.setVariable("rubyLocation", toolPath);
    tool.prependPath(toolPath);
}
