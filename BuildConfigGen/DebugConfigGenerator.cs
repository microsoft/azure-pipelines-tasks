using System.Text.Json.Nodes;

namespace BuildConfigGen
{
    internal interface DebugConfigGenerator
    {
        void AddForTask(string taskConfigPath);

        void CommitChanges();
    }

    internal class NoDebugConfigGenerator : DebugConfigGenerator
    {
        public void AddForTask(string taskConfigPath)
        {
            // noop
        }

        public void CommitChanges()
        {
            // noop
        }
    }

    internal class VsCodeLaunchConfigGenerator : DebugConfigGenerator
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
                throw new ArgumentException($"Agent directory at {Path.GetFullPath(agentPath)} does not exist!");
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

        public void CommitChanges()
        {
            var launchConfigString = LaunchConfig.ToJsonString();
            File.WriteAllText(LaunchConfigPath, launchConfigString);
        }
    }
}
