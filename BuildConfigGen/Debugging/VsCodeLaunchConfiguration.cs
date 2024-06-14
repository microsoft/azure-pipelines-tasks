using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace BuildConfigGen
{
    internal partial class VsCodeLaunchConfiguration
    {
        private JsonObject LaunchConfiguration { get; }

        private JsonArray ConfigurationsList => _configurationsList.Value;

        private readonly Lazy<JsonArray> _configurationsList;

        public VsCodeLaunchConfiguration(JsonObject launchConfiguration)
        {
            ArgumentNullException.ThrowIfNull(launchConfiguration);
            LaunchConfiguration = launchConfiguration;

            _configurationsList = new(() =>
            {
                if (!LaunchConfiguration.TryGetPropertyValue("configurations", out JsonNode? configurationsNode))
                {
                    configurationsNode = new JsonArray();
                    LaunchConfiguration["configurations"] = configurationsNode;
                }
                return configurationsNode!.AsArray();
            });
        }

        public static VsCodeLaunchConfiguration ReadFromFileIfPresentOrDefault(string configPath)
        {
            ArgumentException.ThrowIfNullOrEmpty(configPath);

            JsonObject launchConfiguration;
            if (File.Exists(configPath))
            {
                var rawConfigurationsString = File.ReadAllText(configPath);
                var safeConfigurationsString = RemoveJsonComments(rawConfigurationsString);

                launchConfiguration = JsonNode.Parse(safeConfigurationsString)?.AsObject() ?? throw new ArgumentException($"Provided configuration file at {Path.GetFullPath(configPath)} is not a valid JSON file!");
            } else
            {
                launchConfiguration = new JsonObject
                {
                    ["version"] = "0.2.0",
                    ["configurations"] = new JsonArray()
                };
            }

            return new VsCodeLaunchConfiguration(launchConfiguration);
        }

        public void AddConfigForTask(
            string taskName,
            string taskVersion,
            string taskId,
            string agentPath)
        {
            ArgumentException.ThrowIfNullOrEmpty(taskName);
            ArgumentException.ThrowIfNullOrEmpty(taskVersion);
            ArgumentException.ThrowIfNullOrEmpty(taskId);
            ArgumentException.ThrowIfNullOrEmpty(agentPath);

            var launchConfigName = GetLaunchConfigurationName(taskName, taskVersion);

            var existingLaunchConfig = ConfigurationsList.FirstOrDefault(x =>
            {
                var name = x?[c_taskName]?.GetValue<string>();

                return string.Equals(name, launchConfigName, StringComparison.OrdinalIgnoreCase);
            });

            ConfigurationsList.Remove(existingLaunchConfig);

            var launchConfig = new JsonObject
            {
                [c_taskName] = launchConfigName,
                ["type"] = "node",
                ["request"] = "attach",
                ["address"] = "localhost",
                ["port"] = 9229,
                ["autoAttachChildProcesses"] = true,
                ["skipFiles"] = new JsonArray("<node_internals>/**"),
                ["sourceMaps"] = true,
                ["remoteRoot"] = GetRemoteSourcesPath(taskName, taskVersion, taskId, agentPath)
            };

            ConfigurationsList.Add(launchConfig);
        }

        public string ToJsonString()
        {
            var options = new JsonSerializerOptions { WriteIndented = true };
            return JsonSerializer.Serialize(LaunchConfiguration, options);
        }

        private static string GetLaunchConfigurationName(string task, string version) =>
            $"Attach to {task} ({version})";

        private static string GetRemoteSourcesPath(string taskName, string taskVersion, string taskId, string agentPath) =>
            @$"{agentPath}\_work\_tasks\{taskName}_{taskId.ToLower()}\{taskVersion}";

        private static string RemoveJsonComments(string jsonString)
        {
            jsonString = SingleLineCommentsRegex().Replace(jsonString, string.Empty);
            jsonString = MultiLineCommentsRegex().Replace(jsonString, string.Empty);
            return jsonString;
        }

        [GeneratedRegex(@"//.*(?=\r?\n|$)")]
        private static partial Regex SingleLineCommentsRegex();

        [GeneratedRegex(@"/\*.*?\*/", RegexOptions.Singleline)]
        private static partial Regex MultiLineCommentsRegex();

        private const string c_taskName = "name";
    }
}
