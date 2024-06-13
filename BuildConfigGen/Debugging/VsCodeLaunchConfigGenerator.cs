using System.Text.Json;
using System.Text.Json.Nodes;

namespace BuildConfigGen.Debugging
{
    internal class VsCodeLaunchConfigGenerator : IDebugConfigGenerator
    {
        private string GitRootPath { get; }

        private string AgentPath { get; }

        private string LaunchConfigPath => Path.Combine(GitRootPath, ".vscode", "launch.json");

        private VsCodeLaunchConfiguration LaunchConfig { get; }

        public VsCodeLaunchConfigGenerator(string gitRootPath, string agentPath)
        {
            ArgumentException.ThrowIfNullOrEmpty(agentPath, nameof(agentPath));
            ArgumentException.ThrowIfNullOrEmpty(gitRootPath, nameof(gitRootPath));

            if (!Directory.Exists(agentPath))
            {
                throw new ArgumentException($"Agent directory used for debugging could not be found at {Path.GetFullPath(agentPath)}!");
            }

            AgentPath = agentPath;
            GitRootPath = gitRootPath;
            LaunchConfig = VsCodeLaunchConfiguration.ReadFrom(LaunchConfigPath);
        }

        public void AddForTask(string taskConfigPath)
        {
            if (!File.Exists(taskConfigPath))
            {
                throw new ArgumentException($"Task configuration (task.json) does not exist at path {taskConfigPath}!");
            }

            var taskContent = File.ReadAllText(taskConfigPath);
            var taskConfig = JsonNode.Parse(taskContent)!;

            JsonNode versionNode = taskConfig["version"]!;
            int major = versionNode["Major"]!.GetValue<int>();
            int minor = versionNode["Minor"]!.GetValue<int>();
            int patch = versionNode["Patch"]!.GetValue<int>();

            var version = new TaskVersion(major, minor, patch);

            LaunchConfig.AddConfigForTask(
                taskId: taskConfig["id"]!.GetValue<string>(),
                taskName: taskConfig["name"]!.GetValue<string>(),
                taskVersion: version.ToString(),
                agentPath: AgentPath
            );
        }

        public void WriteLaunchConfigurations()
        {
            var launchConfigString = LaunchConfig.ToJsonString();
            File.WriteAllText(LaunchConfigPath, launchConfigString);
        }

        public void WriteTypescriptConfig(string taskOutput)
        {
            var tsconfigPath = Path.Combine(taskOutput, "tsconfig.json");
            if (!File.Exists(tsconfigPath))
            {
                return;
            }

            var tsConfigContent = File.ReadAllText(tsconfigPath);
            var tsConfigObject = JsonNode.Parse(tsConfigContent)?.AsObject();

            if (tsConfigObject == null)
            {
                return;
            }

            var compilerOptionsObject = tsConfigObject["compilerOptions"]?.AsObject();
            compilerOptionsObject?.Add("inlineSourceMap", true);
            compilerOptionsObject?.Add("inlineSources", true);

            JsonSerializerOptions options = new() { WriteIndented = true };
            var outputTsConfigString = JsonSerializer.Serialize(tsConfigObject, options);
            File.WriteAllText(tsconfigPath, outputTsConfigString);
        }
    }
}
