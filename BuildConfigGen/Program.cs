﻿using System.Diagnostics;
using System.Diagnostics.CodeAnalysis;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using BuildConfigGen.Debugging;

namespace BuildConfigGen
{

    internal class Knob
    {
        public static readonly Knob Default = new Knob { SourceDirectoriesMustContainPlaceHolders = false };

        // when true, Source Directories must contain _buildConfigs placeholders for each build config
        // _buildConfigs are written to each directory when --write-updates is specified
        // setting to false for now so we're not forced to check in a lot of placeholders to tasks that don't use them
        public bool SourceDirectoriesMustContainPlaceHolders { get; init; }
    }

    internal class Program
    {
        private const string filesOverriddenForConfigGoHereReadmeTxt = "FilesOverriddenForConfigGoHereREADME.txt";
        private const string buildConfigs = "_buildConfigs";
        static readonly JsonSerializerOptions jso = new System.Text.Json.JsonSerializerOptions { WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

        internal static class Config
        {
            public static readonly string[] ExtensionsToPreprocess = new[] { ".ts", ".json" };

            public record ConfigRecord(string name, string constMappingKey, bool isDefault, bool isNode, string nodePackageVersion, bool isWif, string nodeHandler, string preprocessorVariableName, bool enableBuildConfigOverrides, bool deprecated, bool shouldUpdateTypescript, bool writeNpmrc, string? overriddenDirectoryName = null, bool shouldUpdateLocalPkgs = false, bool useGlobalVersion = false);

            public static readonly ConfigRecord Default = new ConfigRecord(name: nameof(Default), constMappingKey: "Default", isDefault: true, isNode: false, nodePackageVersion: "", isWif: false, nodeHandler: "", preprocessorVariableName: "DEFAULT", enableBuildConfigOverrides: false, deprecated: false, shouldUpdateTypescript: false, writeNpmrc: false);
            public static readonly ConfigRecord Node16 = new ConfigRecord(name: nameof(Node16), constMappingKey: "Node16-219", isDefault: false, isNode: true, nodePackageVersion: "^16.11.39", isWif: false, nodeHandler: "Node16", preprocessorVariableName: "NODE16", enableBuildConfigOverrides: true, deprecated: true, shouldUpdateTypescript: false, writeNpmrc: false);
            public static readonly ConfigRecord Node16_225 = new ConfigRecord(name: nameof(Node16_225), constMappingKey: "Node16-225", isDefault: false, isNode: true, isWif: false, nodePackageVersion: "^16.11.39", nodeHandler: "Node16", preprocessorVariableName: "NODE16", enableBuildConfigOverrides: true, deprecated: false, shouldUpdateTypescript: false, overriddenDirectoryName: "Node16", writeNpmrc: false);
            public static readonly ConfigRecord Node20 = new ConfigRecord(name: nameof(Node20), constMappingKey: "Node20-225", isDefault: false, isNode: true, nodePackageVersion: "^20.3.1", isWif: false, nodeHandler: "Node20_1", preprocessorVariableName: "NODE20", enableBuildConfigOverrides: true, deprecated: false, shouldUpdateTypescript: true, overriddenDirectoryName: "Node20", writeNpmrc: true);
            public static readonly ConfigRecord Node20_228 = new ConfigRecord(name: nameof(Node20_228), constMappingKey: "Node20-228", isDefault: false, isNode: true, nodePackageVersion: "^20.11.0", isWif: false, nodeHandler: "Node20_1", preprocessorVariableName: "NODE20", enableBuildConfigOverrides: true, deprecated: false, shouldUpdateTypescript: true, overriddenDirectoryName: "Node20", writeNpmrc: true);
            public static readonly ConfigRecord Node20_229_1 = new ConfigRecord(name: nameof(Node20_229_1), constMappingKey: "Node20_229_1", isDefault: false, isNode: true, nodePackageVersion: "^20.3.1", isWif: false, nodeHandler: "Node20_1", preprocessorVariableName: "NODE20", enableBuildConfigOverrides: true, deprecated: false, shouldUpdateTypescript: true, overriddenDirectoryName: "Node20", writeNpmrc: true);
            public static readonly ConfigRecord Node20_229_2 = new ConfigRecord(name: nameof(Node20_229_2), constMappingKey: "Node20_229_2", isDefault: false, isNode: true, nodePackageVersion: "^20.3.1", isWif: false, nodeHandler: "Node20_1", preprocessorVariableName: "NODE20", enableBuildConfigOverrides: true, deprecated: false, shouldUpdateTypescript: true, overriddenDirectoryName: "Node20", writeNpmrc: true);
            public static readonly ConfigRecord Node20_229_3 = new ConfigRecord(name: nameof(Node20_229_3), constMappingKey: "Node20_229_3", isDefault: false, isNode: true, nodePackageVersion: "^20.3.1", isWif: false, nodeHandler: "Node20_1", preprocessorVariableName: "NODE20", enableBuildConfigOverrides: true, deprecated: false, shouldUpdateTypescript: true, overriddenDirectoryName: "Node20", writeNpmrc: true);
            public static readonly ConfigRecord Node20_229_4 = new ConfigRecord(name: nameof(Node20_229_4), constMappingKey: "Node20_229_4", isDefault: false, isNode: true, nodePackageVersion: "^20.11.0", isWif: false, nodeHandler: "Node20_1", preprocessorVariableName: "NODE20", enableBuildConfigOverrides: true, deprecated: false, shouldUpdateTypescript: true, overriddenDirectoryName: "Node20", writeNpmrc: true);
            public static readonly ConfigRecord Node20_229_5 = new ConfigRecord(name: nameof(Node20_229_5), constMappingKey: "Node20_229_5", isDefault: false, isNode: true, nodePackageVersion: "^20.3.1", isWif: false, nodeHandler: "Node20_1", preprocessorVariableName: "NODE20", enableBuildConfigOverrides: true, deprecated: false, shouldUpdateTypescript: true, overriddenDirectoryName: "Node20", writeNpmrc: true);
            public static readonly ConfigRecord Node20_229_6 = new ConfigRecord(name: nameof(Node20_229_6), constMappingKey: "Node20_229_6", isDefault: false, isNode: true, nodePackageVersion: "^20.3.1", isWif: false, nodeHandler: "Node20_1", preprocessorVariableName: "NODE20", enableBuildConfigOverrides: true, deprecated: false, shouldUpdateTypescript: true, overriddenDirectoryName: "Node20", writeNpmrc: true);
            public static readonly ConfigRecord Node20_229_7 = new ConfigRecord(name: nameof(Node20_229_7), constMappingKey: "Node20_229_7", isDefault: false, isNode: true, nodePackageVersion: "^20.3.1", isWif: false, nodeHandler: "Node20_1", preprocessorVariableName: "NODE20", enableBuildConfigOverrides: true, deprecated: false, shouldUpdateTypescript: true, overriddenDirectoryName: "Node20", writeNpmrc: true);
            public static readonly ConfigRecord Node20_229_8 = new ConfigRecord(name: nameof(Node20_229_8), constMappingKey: "Node20_229_8", isDefault: false, isNode: true, nodePackageVersion: "^20.3.1", isWif: false, nodeHandler: "Node20_1", preprocessorVariableName: "NODE20", enableBuildConfigOverrides: true, deprecated: false, shouldUpdateTypescript: true, overriddenDirectoryName: "Node20", writeNpmrc: true);
            public static readonly ConfigRecord Node20_229_9 = new ConfigRecord(name: nameof(Node20_229_9), constMappingKey: "Node20_229_9", isDefault: false, isNode: true, nodePackageVersion: "^20.3.1", isWif: false, nodeHandler: "Node20_1", preprocessorVariableName: "NODE20", enableBuildConfigOverrides: true, deprecated: false, shouldUpdateTypescript: true, overriddenDirectoryName: "Node20", writeNpmrc: true);
            public static readonly ConfigRecord Node20_229_10 = new ConfigRecord(name: nameof(Node20_229_10), constMappingKey: "Node20_229_10", isDefault: false, isNode: true, nodePackageVersion: "^20.3.1", isWif: false, nodeHandler: "Node20_1", preprocessorVariableName: "NODE20", enableBuildConfigOverrides: true, deprecated: false, shouldUpdateTypescript: true, overriddenDirectoryName: "Node20", writeNpmrc: true);
            public static readonly ConfigRecord Node20_229_11 = new ConfigRecord(name: nameof(Node20_229_11), constMappingKey: "Node20_229_11", isDefault: false, isNode: true, nodePackageVersion: "^20.3.1", isWif: false, nodeHandler: "Node20_1", preprocessorVariableName: "NODE20", enableBuildConfigOverrides: true, deprecated: false, shouldUpdateTypescript: true, overriddenDirectoryName: "Node20", writeNpmrc: true);
            public static readonly ConfigRecord Node20_229_12 = new ConfigRecord(name: nameof(Node20_229_12), constMappingKey: "Node20_229_12", isDefault: false, isNode: true, nodePackageVersion: "^20.3.1", isWif: false, nodeHandler: "Node20_1", preprocessorVariableName: "NODE20", enableBuildConfigOverrides: true, deprecated: false, shouldUpdateTypescript: true, overriddenDirectoryName: "Node20", writeNpmrc: true);
            public static readonly ConfigRecord Node20_229_13 = new ConfigRecord(name: nameof(Node20_229_13), constMappingKey: "Node20_229_13", isDefault: false, isNode: true, nodePackageVersion: "^20.11.0", isWif: false, nodeHandler: "Node20_1", preprocessorVariableName: "NODE20", enableBuildConfigOverrides: true, deprecated: false, shouldUpdateTypescript: true, overriddenDirectoryName: "Node20", writeNpmrc: true);
            public static readonly ConfigRecord Node20_229_14 = new ConfigRecord(name: nameof(Node20_229_14), constMappingKey: "Node20_229_14", isDefault: false, isNode: true, nodePackageVersion: "^20.3.1", isWif: false, nodeHandler: "Node20_1", preprocessorVariableName: "NODE20", enableBuildConfigOverrides: true, deprecated: false, shouldUpdateTypescript: true, overriddenDirectoryName: "Node20", writeNpmrc: true);
            public static readonly ConfigRecord WorkloadIdentityFederation = new ConfigRecord(name: nameof(WorkloadIdentityFederation), constMappingKey: "WorkloadIdentityFederation", isDefault: false, isNode: true, nodePackageVersion: "^16.11.39", isWif: true, nodeHandler: "Node16", preprocessorVariableName: "WORKLOADIDENTITYFEDERATION", enableBuildConfigOverrides: true, deprecated: false, shouldUpdateTypescript: false, writeNpmrc: false);
            public static readonly ConfigRecord wif_242 = new ConfigRecord(name: nameof(wif_242), constMappingKey: "wif_242", isDefault: false, isNode: true, nodePackageVersion: "^20.3.1", isWif: true, nodeHandler: "Node20_1", preprocessorVariableName: "WIF", enableBuildConfigOverrides: true, deprecated: false, shouldUpdateTypescript: true, overriddenDirectoryName: "Wif", writeNpmrc: true);
            public static readonly ConfigRecord LocalPackages = new ConfigRecord(name: nameof(LocalPackages), constMappingKey: "LocalPackages", isDefault: false, isNode: true, nodePackageVersion: "^20.3.1", isWif: false, nodeHandler: "Node20_1", preprocessorVariableName: "NODE20", enableBuildConfigOverrides: true, deprecated: false, shouldUpdateTypescript: true, overriddenDirectoryName: "LocalPackages", writeNpmrc: true, shouldUpdateLocalPkgs: true, useGlobalVersion: true);
            public static ConfigRecord[] Configs = { Default, Node16, Node16_225, Node20, Node20_228, Node20_229_1, Node20_229_2, Node20_229_3, Node20_229_4, Node20_229_5, Node20_229_6, Node20_229_7, Node20_229_8, Node20_229_9, Node20_229_10, Node20_229_11, Node20_229_12, Node20_229_13, Node20_229_14, WorkloadIdentityFederation, wif_242, LocalPackages };
        }

        static List<string> notSyncronizedDependencies = [];

        // ensureUpdateModeVerifier wraps all writes.  if writeUpdate=false, it tracks writes that would have occured
        static EnsureUpdateModeVerifier? ensureUpdateModeVerifier;

        /// <param name="task">The task to generate build configs for</param>
        /// <param name="configs">List of configs to generate seperated by |</param>
        /// <param name="currentSprint">Overide current sprint; omit to get from whatsprintis.it</param>
        /// <param name="writeUpdates">Write updates if true, else validate that the output is up-to-date</param>
        /// <param name="allTasks"></param>
        /// <param name="getTaskVersionTable"></param>
        /// <param name="debugAgentDir">When set to the local pipeline agent directory, this tool will produce tasks in debug mode with the corresponding visual studio launch configurations that can be used to attach to built tasks running on this agent</param>
        /// <param name="includeLocalPackagesBuildConfig">Include LocalPackagesBuildConfig</param>
        static void Main(string? task = null, string? configs = null, int? currentSprint = null, bool writeUpdates = false, bool allTasks = false, bool getTaskVersionTable = false, string? debugAgentDir = null, bool includeLocalPackagesBuildConfig = false)
        {
            try
            {
                ensureUpdateModeVerifier = new EnsureUpdateModeVerifier(!writeUpdates);
                MainInner(task, configs, currentSprint, writeUpdates, allTasks, getTaskVersionTable, debugAgentDir, includeLocalPackagesBuildConfig);
            }
            catch (Exception e2)
            {
                // format exceptions nicer than the default formatting.  This prevents a long callstack from DragonFruit and puts the exception on the bottom so it's easier to find.
                // error handling strategy:
                // 1. design: anything goes wrong, try to detect and crash as early as possible to preserve the callstack to make debugging easier.
                // 2. we allow all exceptions to fall though.  Non-zero exit code will be surfaced
                // 3. Ideally default windows exception will occur and errors reported to WER/watson.  I'm not sure this is happening, perhaps DragonFruit is handling the exception

                var restore = Console.ForegroundColor;
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine(e2.ToString());
                Console.ForegroundColor = restore;
                Console.WriteLine();
                Console.WriteLine("An exception occured generating configs. Exception message below: (full callstack above)");
                Console.WriteLine(e2.Message);

                Environment.Exit(1);
            }
        }

        private static void MainInner(string? task, string? configs, int? currentSprintNullable, bool writeUpdates, bool allTasks, bool getTaskVersionTable, string? debugAgentDir, bool includeLocalPackagesBuildConfig)
        {
            if (allTasks)
            {
                NullOrThrow(task, "If allTasks specified, task must not be supplied");
                NullOrThrow(configs, "If allTasks specified, configs must not be supplied");
            }
            else
            {
                NotNullOrThrow(task, "Task is required");
            }

            string currentDir = Environment.CurrentDirectory;
            string gitRootPath = GitUtil.GetGitRootPath(currentDir);

            string globalVersionPath = Path.Combine(gitRootPath, @"globalversion.txt");
            TaskVersion? globalVersion = GetGlobalVersion(gitRootPath, globalVersionPath);

            if (getTaskVersionTable)
            {
                var tasks = MakeOptionsReader.ReadMakeOptions(gitRootPath);

                Console.WriteLine("config\ttask\tversion");

                foreach (var t in tasks.Values)
                {
                    GetVersions(t.Name, string.Join('|', t.Configs), out var r, globalVersion);

                    foreach (var z in r)
                    {
                        Console.WriteLine(string.Concat(z.config, "\t", z.task, "\t", z.version));
                    }
                }

                return;
            }

            IDebugConfigGenerator debugConfGen = string.IsNullOrEmpty(debugAgentDir)
                ? new NoDebugConfigGenerator()
                : new VsCodeLaunchConfigGenerator(gitRootPath, debugAgentDir);

            int maxPatchForCurrentSprint = 0;

            int currentSprint;
            if (currentSprintNullable.HasValue)
            {
                currentSprint = currentSprintNullable.Value;
            }
            else
            {
                currentSprint = GetCurrentSprint();
            }

            Dictionary<string, TaskStateStruct> taskVersionInfo = [];

            {
                var tasks = MakeOptionsReader.ReadMakeOptions(gitRootPath).AsEnumerable()
                    .Where(c => c.Value.Configs.Any()); // only tasks with configs

                if (!allTasks)
                {
                    var taskList = task!.Split(',', '|');

                    tasks = tasks.Where(s => taskList.Where(tl => string.Equals(tl, s.Key, StringComparison.OrdinalIgnoreCase)).Any());
                }

                foreach (var t in tasks)
                {
                    taskVersionInfo.Add(t.Value.Name, new TaskStateStruct([], []));
                }

                foreach (var t in tasks)
                {
                    IEnumerable<string> configsList = FilterConfigsForTask(configs, t);
                    HashSet<Config.ConfigRecord> targetConfigs = GetConfigRecords(configsList, writeUpdates);
                    UpdateVersionsForTask(t.Value.Name, taskVersionInfo[t.Value.Name], targetConfigs, currentSprint, globalVersionPath, ref maxPatchForCurrentSprint, globalVersion);
                    CheckForDuplicates(t.Value.Name, taskVersionInfo[t.Value.Name].configTaskVersionMapping);
                }

                if (includeLocalPackagesBuildConfig)
                {
                    foreach (var t in tasks)
                    {
                        IEnumerable<string> configsList = FilterConfigsForTask(configs, t);

                        if (globalVersion is null)
                        {
                            globalVersion = new TaskVersion(0, currentSprint, maxPatchForCurrentSprint);
                        }
                        else
                        {
                            if (globalVersion.Minor == currentSprint)
                            {
                                globalVersion = globalVersion.CloneWithMinorAndPatch(currentSprint, Math.Max(maxPatchForCurrentSprint, globalVersion.Patch));
                                globalVersion = globalVersion.CloneWithMajor(taskVersionInfo[t.Value.Name].configTaskVersionMapping[Config.Default].Major);
                            }
                            else
                            {
                                globalVersion = globalVersion.CloneWithMinorAndPatch(currentSprint, 0);
                                globalVersion = globalVersion.CloneWithMajor(taskVersionInfo[t.Value.Name].configTaskVersionMapping[Config.Default].Major);
                            }
                        }

                        // populate global verison information
                        HashSet<Config.ConfigRecord> targetConfigs = GetConfigRecords(configsList, writeUpdates);

                        if (globalVersion is null)
                        {
                            throw new Exception("globalVersion shouldn't be null here");
                        }

                        UpdateVersionsGlobal(t.Value.Name, taskVersionInfo[t.Value.Name], targetConfigs, globalVersion);
                        CheckForDuplicates(t.Value.Name, taskVersionInfo[t.Value.Name].configTaskVersionMapping);
                    }

                    ensureUpdateModeVerifier!.WriteAllText(globalVersionPath, globalVersion!.MinorPatchToString(), false);
                    ThrowWithUserFriendlyErrorToRerunWithWriteUpdatesIfVeriferError("(global)", skipContentCheck: false);
                }

                foreach (var t in tasks)
                {
                    IEnumerable<string> configsList = FilterConfigsForTask(configs, t);

                    MainUpdateTask(taskVersionInfo[t.Value.Name], t.Value.Name, configsList, writeUpdates, currentSprint, debugConfGen, includeLocalPackagesBuildConfig, hasGlobalVersion: globalVersion is not null);
                }

                debugConfGen.WriteLaunchConfigurations();

                if (notSyncronizedDependencies.Count > 0)
                {
                    notSyncronizedDependencies.Insert(0, $"##vso[task.logissue type=error]There are problems with the dependencies in the buildConfig's package.json files. Please fix the following issues:");
                    throw new Exception(string.Join("\r\n", notSyncronizedDependencies));
                }
            }
        }

        private static IEnumerable<string> FilterConfigsForTask(string? configs, KeyValuePair<string, MakeOptionsReader.AgentTask> t)
        {
            var configsList = t.Value.Configs.AsEnumerable();
            if (configs != null)
            {
                var configsList2 = configs!.Split(',', '|');
                configsList = configsList.Where(s => configsList2.Where(tl => string.Equals(tl, s, StringComparison.OrdinalIgnoreCase)).Any());
            }

            return configsList;
        }

        private static void CheckForDuplicates(string task, Dictionary<Config.ConfigRecord, TaskVersion> configTaskVersionMapping)
        {
            var duplicateVersions = configTaskVersionMapping.GroupBy(x => x.Value).Select(x => new { version = x.Key, configName = String.Join(",", x.Select(x => x.Key.name)), count = x.Count() }).Where(x => x.count > 1);
            if (duplicateVersions.Any())
            {
                StringBuilder dupConfigsStr = new StringBuilder();
                foreach (var x in duplicateVersions)
                {
                    dupConfigsStr.AppendLine($"task={task} version={x.version} specified in multiple configName={x.configName} config count={x.count}");
                }

                throw new Exception(dupConfigsStr.ToString());
            }
        }

        private static void NullOrThrow<T>(T value, string message)
        {
            if (value != null)
            {
                throw new Exception(message);
            }
        }

        private static void NotNullOrThrow<T>([NotNull] T value, string message)
        {
            if (value == null)
            {
                throw new Exception(message);
            }
        }

        private static void GetVersions(string task, string configsString, out List<(string task, string config, string version)> versionList, TaskVersion? globalVersion)
        {
            versionList = new List<(string task, string config, string version)>();

            if (string.IsNullOrEmpty(task))
            {
                throw new Exception("task expected!");
            }

            if (string.IsNullOrEmpty(configsString))
            {
                throw new Exception("configs expected!");
            }

            string currentDir = Environment.CurrentDirectory;

            string gitRootPath = GitUtil.GetGitRootPath(currentDir);

            string taskTargetPath = Path.Combine(gitRootPath, "Tasks", task);
            if (!Directory.Exists(taskTargetPath))
            {
                throw new Exception($"expected {taskTargetPath} to exist!");
            }

            string generatedFolder = Path.Combine(gitRootPath, "_generated");
            if (!Directory.Exists(generatedFolder))
            {
                throw new Exception("_generated does not exist");
            }

            string versionMapFile = Path.Combine(gitRootPath, "_generated", @$"{task}.versionmap.txt");

            try
            {
                if (ReadVersionMap(versionMapFile, out var versionMap, out var maxVersionNullable, globalVersion))
                {
                    foreach (var version in versionMap)
                    {
                        versionList.Add((task, version.Key, version.Value));
                    }
                }
                else
                {
                    throw new Exception($"versionMapFile {versionMapFile} does not exist");
                }

                ThrowWithUserFriendlyErrorToRerunWithWriteUpdatesIfVeriferError(task, skipContentCheck: false);
            }
            finally
            {
                if (ensureUpdateModeVerifier != null)
                {
                    ensureUpdateModeVerifier.CleanupTempFiles();
                }
            }
        }

        private static int GetCurrentSprint()
        {
            // Scheduled time for Cortesy Push
            var cortesyPushScheduleDay = DayOfWeek.Tuesday;
            var cortesyPushUtcTime = new TimeOnly(8, 30); //UTC time

            string url = "https://whatsprintis.it";
            var httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.Add("Accept", "application/json");

            string json = httpClient.GetStringAsync(url).Result;
            JsonDocument currentSprintData = JsonDocument.Parse(json);
            int currentSprint = currentSprintData.RootElement.GetProperty("sprint").GetInt32();
            int week = currentSprintData.RootElement.GetProperty("week").GetInt32();

            if (week == 3) // if it is the end of the current sprint
            {
                var nowUtc = DateTime.UtcNow;

                // Increase sprint number if scheduled pipeline was already triggered
                if (nowUtc.DayOfWeek > cortesyPushScheduleDay)
                {
                    currentSprint++;
                }
                else if (nowUtc.DayOfWeek == cortesyPushScheduleDay)
                {
                    if (TimeOnly.FromDateTime(nowUtc) >= cortesyPushUtcTime)
                    {
                        currentSprint++;
                    }
                }
            }

            return currentSprint;
        }

        private static void ThrowWithUserFriendlyErrorToRerunWithWriteUpdatesIfVeriferError(string task, bool skipContentCheck)
        {
            // if !writeUpdates, error if we have written any updates
            var verifyErrors = ensureUpdateModeVerifier!.GetVerifyErrors(skipContentCheck).ToList();
            if (verifyErrors.Count != 0)
            {
                Console.WriteLine("");

                Console.WriteLine("Updates needed:");
                foreach (var s in verifyErrors)
                {
                    Console.WriteLine(s);
                }

                throw new Exception($"Updates to generated files must be checked in, please run node make.js --task {task} ");
            }
        }

        private static void MainUpdateTask(
            TaskStateStruct taskVersionState,
            string task,
            IEnumerable<string> configs,
            bool writeUpdates,
            int currentSprint,
            IDebugConfigGenerator debugConfigGen,
            bool includeLocalPackagesBuildConfig,
            bool hasGlobalVersion
            )
        {
            if (string.IsNullOrEmpty(task))
            {
                throw new Exception("task expected!");
            }

            HashSet<Config.ConfigRecord> targetConfigs = GetConfigRecords(configs, writeUpdates);

            try
            {
                string currentDir = Environment.CurrentDirectory;
                string gitRootPath = GitUtil.GetGitRootPath(currentDir);
                string versionMapFile = GetVersionMapFile(task, gitRootPath);

                string taskTargetPath = Path.Combine(gitRootPath, "Tasks", task);
                if (!Directory.Exists(taskTargetPath))
                {
                    throw new Exception($"expected {taskTargetPath} to exist!");
                }

                string taskHandler = Path.Combine(taskTargetPath, "task.json");
                JsonNode taskHandlerContents = JsonNode.Parse(ensureUpdateModeVerifier!.FileReadAllText(taskHandler))!;

                if (targetConfigs.Any(x => x.isNode))
                {
                    // Task may not have nodejs or packages.json (example: AutomatedAnalysisV0) 
                    if (!HasNodeHandler(taskHandlerContents))
                    {
                        Console.WriteLine($"Skipping {task} because task doesn't have node handler does not exist");
                        return;
                    }
                }

                // Create _generated
                string generatedFolder = Path.Combine(gitRootPath, "_generated");
                if (!Directory.Exists(generatedFolder))
                {
                    ensureUpdateModeVerifier!.DirectoryCreateDirectory(generatedFolder, false);
                }

                foreach (var config in targetConfigs)
                {
                    if (config.useGlobalVersion && !hasGlobalVersion)
                    {
                        Console.WriteLine($"MainUpdateTask: Skipping useGlobalVersion config for task b/c GlobalVersion not initialized.  (run with --include-use-local-task-lib-and-common-packages.  hasGlobalVersion={hasGlobalVersion} config.useGlobalVersion={config.useGlobalVersion}");
                    }
                    else
                    {
                        bool versionUpdated = taskVersionState.versionsUpdated.Contains(config);

                        string taskOutput;
                        if (config.isDefault)
                        {
                            taskOutput = Path.Combine(gitRootPath, "_generated", task);
                        }
                        else
                        {
                            string directoryName = config.name;
                            if (config.overriddenDirectoryName != null)
                            {
                                directoryName = config.overriddenDirectoryName;
                            }

                            taskOutput = Path.Combine(gitRootPath, "_generated", @$"{task}_{directoryName}");
                        }

                        if (config.enableBuildConfigOverrides)
                        {
                            EnsureBuildConfigFileOverrides(config, taskTargetPath);
                        }

                        var taskConfigPath = Path.Combine(taskOutput, "task.json");
                        var taskConfigExists = File.Exists(taskConfigPath);

                        // only update task output if a new version was added, the config exists, the task contains preprocessor instructions, or the config targets Node (not Default)
                        // Note: CheckTaskInputContainsPreprocessorInstructions is expensive, so only call if needed
                        if (versionUpdated || taskConfigExists || HasTaskInputContainsPreprocessorInstructions(taskTargetPath, config) || config.isNode)
                        {
                            CopyConfig(taskTargetPath, taskOutput, skipPathName: buildConfigs, skipFileName: null, removeExtraFiles: true, throwIfNotUpdatingFileForApplyingOverridesAndPreProcessor: false, config: config, allowPreprocessorDirectives: true);

                            if (config.enableBuildConfigOverrides)
                            {
                                CopyConfigOverrides(taskTargetPath, taskOutput, config);
                            }

                            // if some files aren't present in destination, stop as following code assumes they're present and we'll just get a FileNotFoundException
                            // don't check content as preprocessor hasn't run
                            ThrowWithUserFriendlyErrorToRerunWithWriteUpdatesIfVeriferError(task, skipContentCheck: true);

                            HandlePreprocessingInTarget(taskOutput, config, validateAndWriteChanges: true, out _);

                            WriteWIFInputTaskJson(taskOutput, config, "task.json", isLoc: false);
                            WriteWIFInputTaskJson(taskOutput, config, "task.loc.json", isLoc: true);
                            WriteTaskJson(taskOutput, taskVersionState.configTaskVersionMapping, config, "task.json");
                            WriteTaskJson(taskOutput, taskVersionState.configTaskVersionMapping, config, "task.loc.json");
                        }
                        WriteInputTaskJson(taskTargetPath, taskVersionState.configTaskVersionMapping, "task.json");
                        WriteInputTaskJson(taskTargetPath, taskVersionState.configTaskVersionMapping, "task.loc.json");

                        if (config.isNode)
                        {
                            GetBuildConfigFileOverridePaths(config, taskTargetPath, out string configTaskPath, out string readmePath);

                            string buildConfigPackageJsonPath = Path.Combine(taskTargetPath, buildConfigs, configTaskPath, "package.json");

                            if (File.Exists(buildConfigPackageJsonPath))
                            {
                                EnsureDependencyVersionsAreSyncronized(
                                    task,
                                    Path.Combine(taskTargetPath, "package.json"),
                                    buildConfigPackageJsonPath);

                            }

                            WriteNodePackageJson(taskOutput, config.nodePackageVersion, config.shouldUpdateTypescript, config.shouldUpdateLocalPkgs);
                        }

                        debugConfigGen.WriteTypescriptConfig(taskOutput);
                        debugConfigGen.AddForTask(taskConfigPath);
                    }
                }

                // delay updating version map file until after buildconfigs generated
                WriteVersionMapFile(versionMapFile, taskVersionState.configTaskVersionMapping, targetConfigs: targetConfigs);

                ThrowWithUserFriendlyErrorToRerunWithWriteUpdatesIfVeriferError(task, skipContentCheck: false);
            }
            finally
            {
                if (ensureUpdateModeVerifier != null)
                {
                    ensureUpdateModeVerifier.CleanupTempFiles();
                }
            }
        }

        private static string GetVersionMapFile(string task, string gitRootPath)
        {
            return Path.Combine(gitRootPath, "_generated", @$"{task}.versionmap.txt");
        }

        private static HashSet<Config.ConfigRecord> GetConfigRecords(IEnumerable<string> configs, bool writeUpdates)
        {
            string errorMessage;

            Dictionary<string, Config.ConfigRecord> configdefs = new(Config.Configs.Where(x => !x.isDefault).Select(x => new KeyValuePair<string, Config.ConfigRecord>(x.name, x)));
            HashSet<Config.ConfigRecord> targetConfigs = new HashSet<Config.ConfigRecord>();
            targetConfigs.Add(Config.Default);
            foreach (var config in configs)
            {
                if (configdefs.TryGetValue(config, out var matchedConfig))
                {
                    if (matchedConfig.deprecated && writeUpdates)
                    {
                        errorMessage = "The config with the name: " + matchedConfig.name + " is deprecated. Writing updates for deprecated configs is not allowed.";
                        throw new Exception(errorMessage);
                    }

                    targetConfigs.Add(matchedConfig);

                }
                else
                {
                    errorMessage = $"Configs ({config}) specified must be one of: " + string.Join(',', Config.Configs.Where(x => !x.isDefault).Select(x => x.name));
                    throw new Exception(errorMessage);
                }
            }

            return targetConfigs;
        }


        // originVersion buildConfigVersion
        private static bool VersionIsGreaterThan(string version1, string version2)
        {
            if (version2.StartsWith("^"))
            {
                // if buildConfig version starts with ^, it's always up to date
                return false;
            }

            const string versionRE = @"(\d+)\.(\d+)\.(\d+)";
            var originMatch = Regex.Match(version1, versionRE);
            var buildConfigMatch = Regex.Match(version2, versionRE);

            if (originMatch.Success && buildConfigMatch.Success)
            {
                var originDependencyVersion = Version.Parse($"{originMatch.Groups[1].Value}.{originMatch.Groups[2].Value}.{originMatch.Groups[3].Value}");
                var generatedDependencyVersion = Version.Parse($"{buildConfigMatch.Groups[1].Value}.{buildConfigMatch.Groups[2].Value}.{buildConfigMatch.Groups[3].Value}");
                return originDependencyVersion.CompareTo(generatedDependencyVersion) > 0;
            }
            else
            {
                if (!originMatch.Success)
                {
                    Console.WriteLine($"VersionIsGreaterThan: {version1} doesn't look like a version");
                }

                if (!buildConfigMatch.Success)
                {
                    Console.WriteLine($"VersionIsGreaterThan: {version2} doesn't look like a version");
                }
            }

            return false;
        }

        private static void EnsureDependencyVersionsAreSyncronized(
            string task,
            string originPackagePath,
            string generatedPackagePath
        )
        {
            NotNullOrThrow(ensureUpdateModeVerifier, "BUG: ensureUpdateModeVerifier is null");

            JsonNode? originTaskPackage = JsonNode.Parse(ensureUpdateModeVerifier.FileReadAllText(originPackagePath));
            JsonNode? buildConfigTaskPackage = JsonNode.Parse(ensureUpdateModeVerifier.FileReadAllText(generatedPackagePath));
            NotNullOrThrow(originTaskPackage, $"BUG: originTaskPackage is null for {task}");
            NotNullOrThrow(buildConfigTaskPackage, $"BUG: buildConfigTaskPackage is null for {task}");

            var originDependencies = originTaskPackage["dependencies"];
            NotNullOrThrow(originDependencies, $"BUG: origin dependencies in {task} is null");

            foreach (var originDependency in originDependencies.AsObject())
            {
                string? originVersion = originDependency.Value?.ToString();
                NotNullOrThrow(originVersion, $"BUG: origin dependency {originDependency.Key} version in {task} is null");
                var buildConfigTaskDependencies = buildConfigTaskPackage["dependencies"];
                NotNullOrThrow(buildConfigTaskDependencies, $"BUG: buildConfigs dependencies in {task} is null");
                string? buildConfigDependencyVersion = buildConfigTaskDependencies[originDependency.Key]?.ToString();

                if (buildConfigDependencyVersion is null)
                {
                    notSyncronizedDependencies.Add($@"Dependency ""{originDependency.Key}"" in {task} is missing in buildConfig's package.json");
                    continue;
                }

                if (buildConfigDependencyVersion.StartsWith("file:")) // skip if config package is file reference
                {
                    // do nothing
                }
                else
                {
                    if (VersionIsGreaterThan(originVersion, buildConfigDependencyVersion))
                    {
                        notSyncronizedDependencies.Add($@"Dependency ""{originDependency.Key}"" in {generatedPackagePath} has {buildConfigDependencyVersion} version and should be updated to {originVersion} as in {originPackagePath}");
                    }
                }
            }
        }

        private static bool HasTaskInputContainsPreprocessorInstructions(string sourcePath, Config.ConfigRecord config)
        {
            HandlePreprocessingInTarget(sourcePath, config, validateAndWriteChanges: false, out bool hasPreprocessorDirectives);
            return hasPreprocessorDirectives;
        }

        private static void EnsureBuildConfigFileOverrides(Config.ConfigRecord config, string taskTargetPath)
        {
            if (!config.enableBuildConfigOverrides)
            {
                throw new Exception("BUG: should not get here: !config.enableBuildConfigOverrides");
            }

            string path, readmeFile;
            GetBuildConfigFileOverridePaths(config, taskTargetPath, out path, out readmeFile);

            if (!Directory.Exists(path))
            {
                ensureUpdateModeVerifier!.DirectoryCreateDirectory(path, suppressValidationErrorIfTargetPathDoesntExist: !Knob.Default.SourceDirectoriesMustContainPlaceHolders);
            }

            ensureUpdateModeVerifier!.WriteAllText(readmeFile, "Place files overridden for this config in this directory", suppressValidationErrorIfTargetPathDoesntExist: !Knob.Default.SourceDirectoriesMustContainPlaceHolders);
        }

        private static void GetBuildConfigFileOverridePaths(Config.ConfigRecord config, string taskTargetPath, out string path, out string readmeFile)
        {
            string directoryName = config.name;

            if (!config.enableBuildConfigOverrides)
            {
                throw new Exception("BUG: should not get here: !config.enableBuildConfigOverrides");
            }

            if (config.overriddenDirectoryName != null)
            {
                directoryName = config.overriddenDirectoryName;
            }

            path = Path.Combine(taskTargetPath, buildConfigs, directoryName);
            readmeFile = Path.Combine(taskTargetPath, buildConfigs, directoryName, filesOverriddenForConfigGoHereReadmeTxt);
        }

        private static void CopyConfigOverrides(string taskTargetPath, string taskOutput, Config.ConfigRecord config)
        {
            if (!config.enableBuildConfigOverrides)
            {
                throw new Exception("BUG: should not get here: !config.enableBuildConfigOverrides");
            }

            string overridePathForBuildConfig;
            GetBuildConfigFileOverridePaths(config, taskTargetPath, out overridePathForBuildConfig, out _);

            bool doCopy;
            if (Knob.Default.SourceDirectoriesMustContainPlaceHolders)
            {
                doCopy = false;
            }
            else
            {
                doCopy = Directory.Exists(overridePathForBuildConfig);
            }

            if (doCopy)
            {
                CopyConfig(overridePathForBuildConfig, taskOutput, skipPathName: null, skipFileName: filesOverriddenForConfigGoHereReadmeTxt, removeExtraFiles: false, throwIfNotUpdatingFileForApplyingOverridesAndPreProcessor: true, config: config, allowPreprocessorDirectives: false);
            }
        }

        private static void HandlePreprocessingInTarget(string taskOutput, Config.ConfigRecord config, bool validateAndWriteChanges, out bool hasDirectives)
        {
            var nonIgnoredFilesInTarget = new HashSet<string>(GitUtil.GetNonIgnoredFileListFromPath(taskOutput));

            hasDirectives = false;

            foreach (var file in nonIgnoredFilesInTarget)
            {
                string taskOutputFile = Path.Combine(taskOutput, file);

                PreprocessIfExtensionEnabledInConfig(taskOutputFile, config, validateAndWriteChanges, out bool madeChanges);

                if (madeChanges)
                {
                    hasDirectives = true;
                }
            }
        }

        private static void PreprocessIfExtensionEnabledInConfig(string file, Config.ConfigRecord config, bool validateAndWriteChanges, out bool madeChanges)
        {
            HashSet<string> extensions = new HashSet<string>(Config.ExtensionsToPreprocess);
            bool preprocessExtension = extensions.Contains(Path.GetExtension(file));
            if (preprocessExtension)
            {
                if (validateAndWriteChanges)
                {
                    Console.WriteLine($"Preprocessing {file}...");
                }
                else
                {
                    Console.WriteLine($"Checking if {file} has preprocessor directives ...");
                }

                Preprocessor.Preprocess(file, ensureUpdateModeVerifier!.FileReadAllLines(file), new HashSet<string>(Config.Configs.Select(s => s.preprocessorVariableName)), config.preprocessorVariableName, out string processedOutput, out var validationErrors, out madeChanges);

                if (validateAndWriteChanges)
                {
                    if (validationErrors.Count() != 0)
                    {
                        Console.WriteLine("Preprocessor validation errors:");
                        foreach (var error in validationErrors)
                        {
                            Console.WriteLine(error);
                        }

                        throw new Exception("Preprocessor validation errors occured");
                    }

                    if (madeChanges)
                    {
                        ensureUpdateModeVerifier!.WriteAllText(file, processedOutput, false);
                        Console.WriteLine("Done");
                    }
                    else
                    {
                        Console.WriteLine("No changes; skipping");
                    }
                }
            }
            else
            {
                madeChanges = false;
            }
        }


        private static void WriteTaskJson(string taskPath, Dictionary<Config.ConfigRecord, TaskVersion> configTaskVersionMapping, Config.ConfigRecord config, string fileName)
        {
            string outputTaskPath = Path.Combine(taskPath, fileName);
            JsonNode outputTaskNode = JsonNode.Parse(ensureUpdateModeVerifier!.FileReadAllText(outputTaskPath))!;
            outputTaskNode["version"]!["Major"] = configTaskVersionMapping[config].Major;
            outputTaskNode["version"]!["Minor"] = configTaskVersionMapping[config].Minor;
            outputTaskNode["version"]!["Patch"] = configTaskVersionMapping[config].Patch;
            outputTaskNode.AsObject()?.Remove("_buildConfigMapping");

            JsonObject configMapping = new JsonObject();
            var configTaskVersionMappingSortedByConfig = configTaskVersionMapping.OrderBy(x => x.Key.name);
            foreach (var cfg in configTaskVersionMappingSortedByConfig)
            {
                configMapping.Add(new(cfg.Key.constMappingKey, cfg.Value.ToString()));
            }

            outputTaskNode.AsObject().Add("_buildConfigMapping", configMapping);

            if (config.isNode)
            {
                AddNodehandler(outputTaskNode, config.nodeHandler);
            }

            ensureUpdateModeVerifier!.WriteAllText(outputTaskPath, outputTaskNode.ToJsonString(jso), suppressValidationErrorIfTargetPathDoesntExist: false);
        }

        private static void WriteWIFInputTaskJson(string taskPath, Config.ConfigRecord config, string fileName, bool isLoc)
        {
            if (!config.isWif)
            {
                return;
            }

            string taskJsonOverridePath = Path.Combine(taskPath, isLoc ? "taskJsonOverride.loc.json" : "taskJsonOverride.json");
            JsonNode inputTaskNode = JsonNode.Parse(ensureUpdateModeVerifier!.FileReadAllText(taskJsonOverridePath))!;
            var clonedArray = JsonNode.Parse(inputTaskNode["inputs"]!.ToJsonString())!.AsArray();

            string outputTaskPath = Path.Combine(taskPath, fileName);
            JsonNode outputTaskNode = JsonNode.Parse(ensureUpdateModeVerifier!.FileReadAllText(outputTaskPath))!;
            outputTaskNode["inputs"] = clonedArray;

            ensureUpdateModeVerifier!.WriteAllText(outputTaskPath, outputTaskNode.ToJsonString(jso), suppressValidationErrorIfTargetPathDoesntExist: false);
        }

        private static void WriteNodePackageJson(string taskOutputNode, string nodeVersion, bool shouldUpdateTypescript, bool shouldUpdateTaskLib)
        {
            string outputNodePackagePath = Path.Combine(taskOutputNode, "package.json");
            JsonNode outputNodePackagePathJsonNode = JsonNode.Parse(ensureUpdateModeVerifier!.FileReadAllText(outputNodePackagePath))!;
            outputNodePackagePathJsonNode["dependencies"]!["@types/node"] = nodeVersion;

            // Upgrade typescript version for Node 20
            if (shouldUpdateTypescript)
            {
                outputNodePackagePathJsonNode["devDependencies"]!["typescript"] = "5.1.6";
            }

            if (shouldUpdateTaskLib)
            {
                UpdateDepNode(outputNodePackagePathJsonNode, "azure-pipelines-task-lib", "file:../../task-lib/node/_build");
                UpdateDepNode(outputNodePackagePathJsonNode, "azure-pipelines-tasks-artifacts-common", "file:../../tasks-common/common-npm-packages/artifacts-common/_build");
                UpdateDepNode(outputNodePackagePathJsonNode, "azp-tasks-az-blobstorage-provider", "file:../../tasks-common/common-npm-packages/az-blobstorage-provider/_build");
                UpdateDepNode(outputNodePackagePathJsonNode, "azure-pipelines-tasks-azure-arm-rest", "file:../../tasks-common/common-npm-packages/azure-arm-rest/_build");
                UpdateDepNode(outputNodePackagePathJsonNode, "azure-pipelines-tasks-azurermdeploycommon", "file:../../tasks-common/common-npm-packages/azurermdeploycommon/_build");
                UpdateDepNode(outputNodePackagePathJsonNode, "azure-pipelines-tasks-codeanalysis-common", "file:../../tasks-common/common-npm-packages/codeanalysis-common/_build");
                UpdateDepNode(outputNodePackagePathJsonNode, "azure-pipelines-tasks-codecoverage-tools", "file:../../tasks-common/common-npm-packages/codecoverage-tools/_build");
                UpdateDepNode(outputNodePackagePathJsonNode, "azure-pipelines-tasks-docker-common", "file:../../tasks-common/common-npm-packages/docker-common/_build");
                UpdateDepNode(outputNodePackagePathJsonNode, "azure-pipelines-tasks-ios-signing-common", "file:../../tasks-common/common-npm-packages/ios-signing-common/_build");
                UpdateDepNode(outputNodePackagePathJsonNode, "azure-pipelines-tasks-java-common", "file:../../tasks-common/common-npm-packages/java-common/_build");
                UpdateDepNode(outputNodePackagePathJsonNode, "azure-pipelines-tasks-kubernetes-common", "file:../../tasks-common/common-npm-packages/kubernetes-common/_build");
                UpdateDepNode(outputNodePackagePathJsonNode, "azure-pipelines-tasks-msbuildhelpers", "file:../../tasks-common/common-npm-packages/msbuildhelpers/_build");
                UpdateDepNode(outputNodePackagePathJsonNode, "azure-pipelines-tasks-packaging-common", "file:../../tasks-common/common-npm-packages/packaging-common/_build");
                UpdateDepNode(outputNodePackagePathJsonNode, "azure-pipelines-tasks-securefiles-common", "file:../../tasks-common/common-npm-packages/securefiles-common/_build");
                UpdateDepNode(outputNodePackagePathJsonNode, "azure-pipelines-tasks-utility-common", "file:../../tasks-common/common-npm-packages/utility-common/_build");
                UpdateDepNode(outputNodePackagePathJsonNode, "azure-pipelines-tasks-webdeployment-common", "file:../../tasks-common/common-npm-packages/webdeployment-common/_build");
            }

            // We need to add newline since npm install command always add newline at the end of package.json
            // https://github.com/npm/npm/issues/18545
            string nodePackageContent = outputNodePackagePathJsonNode.ToJsonString(jso) + Environment.NewLine;
            ensureUpdateModeVerifier!.WriteAllText(outputNodePackagePath, nodePackageContent, suppressValidationErrorIfTargetPathDoesntExist: false);
        }

        private static void UpdateDepNode(JsonNode outputNodePackagePathJsonNode, string module, string buildPath)
        {
            var depNode = outputNodePackagePathJsonNode["dependencies"];
            var f = depNode![module];
            if (f != null)
            {
                outputNodePackagePathJsonNode["dependencies"]![module] = buildPath;
            }
        }

        private static bool HasNodeHandler(JsonNode taskHandlerContents)
        {
            var possibleExecutionHandlers = new[] { "prejobexecution", "execution", "postjobexecution" };

            foreach (var possibleExecutor in possibleExecutionHandlers)
            {
                var handlers = taskHandlerContents[possibleExecutor]?.AsObject();
                if (ExecutorHasNodeHandler(handlers)) { return true; }
            }

            return false;
        }

        private static bool ExecutorHasNodeHandler(JsonObject? executorHandlerContent)
        {
            if (executorHandlerContent == null) { return false; }

            foreach (var k in executorHandlerContent)
            {
                if (k.Key.ToLower().StartsWith("node"))
                {
                    return true;
                }
            }

            return false;
        }

        private static void CopyConfig(string taskTargetPathOrUnderscoreBuildConfigPath, string taskOutput, string? skipPathName, string? skipFileName, bool removeExtraFiles, bool throwIfNotUpdatingFileForApplyingOverridesAndPreProcessor, Config.ConfigRecord config, bool allowPreprocessorDirectives)
        {
            var paths = GitUtil.GetNonIgnoredFileListFromPath(taskTargetPathOrUnderscoreBuildConfigPath);

            HashSet<string> pathsToRemoveFromOutput;

            // In case if task was not generated yet, we don't need to get the list of files to remove, because taskOutput not exists yet
            if (Directory.Exists(taskOutput))
            {
                pathsToRemoveFromOutput = new HashSet<string>(GitUtil.GetNonIgnoredFileListFromPath(taskOutput));
            }
            else
            {
                pathsToRemoveFromOutput = new HashSet<string>();
            }

            if (allowPreprocessorDirectives)
            {
                // do nothing
            }
            else
            {
                if (!config.enableBuildConfigOverrides)
                {
                    throw new Exception("BUG: should not get here: !config.enableBuildConfigOverrides");
                }

                var hasPreprocessorDirectives = HasTaskInputContainsPreprocessorInstructions(taskTargetPathOrUnderscoreBuildConfigPath, config);

                if (hasPreprocessorDirectives)
                {
                    throw new Exception($"Preprocessor directives not supported in files in _buildConfigs taskTargetPathOrUnderscoreBuildConfigPath={taskTargetPathOrUnderscoreBuildConfigPath}");
                }
            }

            foreach (var path in paths)
            {
                string sourcePath = Path.Combine(taskTargetPathOrUnderscoreBuildConfigPath, path);

                if (skipPathName != null && sourcePath.Contains(string.Concat(skipPathName, Path.DirectorySeparatorChar)))
                {
                    // skip the path!  (this is used to skip _buildConfigs in the source task path)
                }
                else
                {
                    _ = pathsToRemoveFromOutput.Remove(path);

                    string targetPath = Path.Combine(taskOutput, path);

                    if (skipFileName != null && sourcePath.Contains(string.Concat(Path.DirectorySeparatorChar.ToString(), skipFileName), StringComparison.OrdinalIgnoreCase))
                    {
                        // e.g. skip filesOverriddenForConfigGoHereReadmeTxt
                    }
                    else
                    {
                        if (throwIfNotUpdatingFileForApplyingOverridesAndPreProcessor && !File.Exists(targetPath))
                        {
                            throw new Exception($"Overriden file must exist in targetPath sourcePath={sourcePath} targetPath={targetPath}");
                        }

                        CopyFile(sourcePath, targetPath);
                    }
                }
            }

            if (removeExtraFiles)
            {
                foreach (var pathToRemoveFromOutput in pathsToRemoveFromOutput)
                {
                    // todo: handle .npmrc properly -- ensure it's content validated properly if written by buildconfiggen
                    if (pathToRemoveFromOutput == ".npmrc")
                    {
                        continue;
                    }

                    string targetPath = Path.Combine(taskOutput, pathToRemoveFromOutput);
                    Console.WriteLine($"Adding .tmp extension to extra file in output directory (should cause it to be ignored by .gitignore): {pathToRemoveFromOutput}");

                    string destFileName = targetPath + ".tmp";
                    if (File.Exists(destFileName))
                    {
                        throw new Exception($"{destFileName} already exists; please clean up");
                    }

                    ensureUpdateModeVerifier!.Move(targetPath, destFileName);
                }
            }

            // https://stackoverflow.com/questions/51293566/how-to-include-the-path-for-the-node-binary-npm-was-executed-with
            if (config.writeNpmrc)
            {
                string targetPath = Path.Combine(taskOutput, ".npmrc");
                ensureUpdateModeVerifier!.WriteAllText(targetPath, @"scripts-prepend-node-path=true
", false);
            }
        }

        private static void UpdateVersionsForTask(string task, TaskStateStruct taskState, HashSet<Config.ConfigRecord> targetConfigs, int currentSprint, string globalVersionPath, ref int maxPatchForCurrentSprint, TaskVersion? globalVersion)
        {
            string currentDir = Environment.CurrentDirectory;
            string gitRootPath = GitUtil.GetGitRootPath(currentDir);
            string taskTargetPath = Path.Combine(gitRootPath, "Tasks", task);

            if (!Directory.Exists(taskTargetPath))
            {
                throw new Exception($"expected {taskTargetPath} to exist!");
            }

            Dictionary<string, TaskVersion> versionMap;
            TaskVersion maxVersion;

            var inputVersion = GetInputVersion(taskTargetPath);

            bool defaultVersionMatchesSourceVersion;

            string versionMapFile = GetVersionMapFile(task, gitRootPath);

            {
                TaskVersion? defaultVersion = null;
                if (ReadVersionMap(versionMapFile, out versionMap, out var maxVersionNullable, globalVersion))
                {
                    maxVersion = maxVersionNullable!;
                    defaultVersion = versionMap[Config.Default.name];
                    defaultVersionMatchesSourceVersion = defaultVersion == inputVersion;
                }
                else
                {
                    maxVersion = inputVersion;
                    defaultVersionMatchesSourceVersion = true;
                }

                if (inputVersion <= maxVersion && !defaultVersionMatchesSourceVersion)
                {
                    throw new Exception($"inputVersion={inputVersion} version specified in task taskTargetPath={taskTargetPath} must not be less or equal to maxversion maxVersion={maxVersion} specified in versionMapFile {versionMapFile} and globalVersionPath={globalVersionPath}, or must match defaultVersion={defaultVersion} in {versionMapFile}");
                }
            }

            // copy the mappings.  As we go check if any configs not mapped. If so, invalidate.
            bool allConfigsMappedAndValid = true;
            foreach (var config in targetConfigs)
            {
                if (versionMap.ContainsKey(config.constMappingKey))
                {
                    taskState.configTaskVersionMapping.Add(config, versionMap[config.constMappingKey]);
                }
                else
                {
                    allConfigsMappedAndValid = false;
                }
            }

            // invalidate if input version is not the default version specified in mapping
            if (allConfigsMappedAndValid)
            {
                if (inputVersion == taskState.configTaskVersionMapping[Config.Default])
                {

                }
                else
                {
                    allConfigsMappedAndValid = false;
                }
            }

            TaskVersion baseVersion = maxVersion;

            bool baseVersionIsCurrentSprint = baseVersion.Minor == currentSprint;

            int offset = 0;

            if (baseVersionIsCurrentSprint)
            {
                offset = 1;
            }
            else
            {
                baseVersion = inputVersion.CloneWithMinorAndPatch(currentSprint, 0);
            }

            if (!allConfigsMappedAndValid)
            {
                var old = new Dictionary<Config.ConfigRecord, TaskVersion>();
                foreach (var x in taskState.configTaskVersionMapping)
                {
                    old.Add(x.Key, x.Value);
                }

                taskState.configTaskVersionMapping.Clear();

                if (defaultVersionMatchesSourceVersion)
                {
                    taskState.configTaskVersionMapping.Add(Config.Default, inputVersion);

                    foreach (var config in targetConfigs)
                    {
                        if (!config.isDefault)
                        {
                            if (old.TryGetValue(config, out var oldVersion))
                            {
                                taskState.configTaskVersionMapping.Add(config, oldVersion);
                            }
                        }
                    }
                }
                else
                {
                    taskState.configTaskVersionMapping.Add(Config.Default, baseVersion.CloneWithPatch(baseVersion.Patch + offset));
                    offset++;
                    taskState.versionsUpdated.Add(Config.Default);
                }

                foreach (var config in targetConfigs)
                {
                    if (!config.isDefault && !taskState.configTaskVersionMapping.ContainsKey(config))
                    {
                        if (config.useGlobalVersion)
                        {
                            // global version is updated unconditionally below
                        }
                        else
                        {
                            TaskVersion targetVersion;

                            do
                            {
                                targetVersion = baseVersion.CloneWithPatch(baseVersion.Patch + offset);
                                offset++;
                            }
                            while (taskState.configTaskVersionMapping.Values.Contains(targetVersion));

                            taskState.configTaskVersionMapping.Add(config, targetVersion);

                            if (!taskState.versionsUpdated.Contains(config))
                            {
                                taskState.versionsUpdated.Add(config);
                            }
                        }
                    }
                }
            }

            foreach (var x in taskState.configTaskVersionMapping)
            {
                if (x.Value.Major == currentSprint)
                {
                    maxPatchForCurrentSprint = Math.Max(x.Value.Patch, maxPatchForCurrentSprint);
                }
            }
        }

        private static void UpdateVersionsGlobal(string task, TaskStateStruct taskState, HashSet<Config.ConfigRecord> targetConfigs, TaskVersion globalVersion)
        {
            foreach (var config in targetConfigs)
            {
                if (config.useGlobalVersion)
                {
                    if (taskState.configTaskVersionMapping.ContainsKey(config))
                    {
                        if (taskState.configTaskVersionMapping[config] != globalVersion)
                        {
                            taskState.configTaskVersionMapping[config] = globalVersion;

                            if (!taskState.versionsUpdated.Contains(config))
                            {
                                taskState.versionsUpdated.Add(config);
                            }
                        }
                    }
                    else
                    {
                        taskState.configTaskVersionMapping.Add(config, globalVersion);

                        if (!taskState.versionsUpdated.Contains(config))
                        {
                            taskState.versionsUpdated.Add(config);
                        }
                    }
                }
            }
        }

        private static TaskVersion? GetGlobalVersion(string srcPath, string globalVersionPath)
        {
            if (!File.Exists(globalVersionPath))
            {
                return null;
            }

            string globalVersionString = File.ReadAllText(globalVersionPath);

            const string shortVersionRegex = @"^\d+\.\d+$";
            Regex re = new Regex(shortVersionRegex);

            if (!re.IsMatch(globalVersionString))
            {
                throw new Exception($"{globalVersionPath} doesn't contain expected content matching {shortVersionRegex}");
            }

            TaskVersion globalVersion = new TaskVersion("0." + globalVersionString);
            return globalVersion;
        }

        private static TaskVersion GetInputVersion(string taskTarget)
        {
            Int32 patch;
            TaskVersion inputVersion;

            string inputTaskPath = Path.Combine(taskTarget, "task.json");
            JsonNode inputTaskNode = JsonNode.Parse(ensureUpdateModeVerifier!.FileReadAllText(inputTaskPath))!;

            Int32 major;
            Int32 minor;

            // Need to parse it to a int because the version can be a string or an int (example: AzureStaticWebAppV0)
            Int32.TryParse(inputTaskNode["version"]!["Major"]!.ToString(), out major);
            Int32.TryParse(inputTaskNode["version"]!["Minor"]!.ToString(), out minor);
            Int32.TryParse(inputTaskNode["version"]!["Patch"]!.ToString(), out patch);

            inputVersion = new(major, minor, patch);

            return inputVersion;
        }

        private static void WriteInputTaskJson(string taskTarget, Dictionary<Config.ConfigRecord, TaskVersion> configTaskVersion, string fileName)
        {
            string inputTaskPath = Path.Combine(taskTarget, fileName);
            JsonNode inputTaskNode = JsonNode.Parse(ensureUpdateModeVerifier!.FileReadAllText(inputTaskPath))!;

            if (
                ((int)inputTaskNode["version"]!["Major"]!) != configTaskVersion[Config.Default].Major
                || ((int)inputTaskNode["version"]!["Minor"]!) != configTaskVersion[Config.Default].Minor
                || ((int)inputTaskNode["version"]!["Patch"]!) != configTaskVersion[Config.Default].Patch
                )
            {
                inputTaskNode["version"]!["Major"] = configTaskVersion[Config.Default].Major;
                inputTaskNode["version"]!["Minor"] = configTaskVersion[Config.Default].Minor;
                inputTaskNode["version"]!["Patch"] = configTaskVersion[Config.Default].Patch;

                ensureUpdateModeVerifier!.WriteAllText(inputTaskPath, inputTaskNode.ToJsonString(jso), suppressValidationErrorIfTargetPathDoesntExist: false);
            }
        }

        private static void WriteVersionMapFile(string versionMapFile, Dictionary<Config.ConfigRecord, TaskVersion> configTaskVersion, HashSet<Config.ConfigRecord> targetConfigs)
        {
            if (targetConfigs.Where(c => !c.isDefault && !c.useGlobalVersion).Any())
            {
                StringBuilder sb = new StringBuilder();
                using (var sw = new StringWriter(sb))
                {
                    foreach (var config in targetConfigs)
                    {
                        if (!config.useGlobalVersion) // do not write globalVersion configs to task-specific
                        {
                            sw.WriteLine(string.Concat(config.constMappingKey, "|", configTaskVersion[config]));
                        }
                    }
                }

                ensureUpdateModeVerifier!.WriteAllText(versionMapFile, sb.ToString(), suppressValidationErrorIfTargetPathDoesntExist: false);
            }
            else
            {
                Console.WriteLine($"Not writing {versionMapFile} because there are no configs for task which are not Default or useGlobalVersion");
            }
        }

        private static string GetExecutionPath(JsonNode taskNode, string execution)
        {
            var handlers = taskNode[execution]?.AsObject();
            if (handlers != null)
            {
                foreach (var k in handlers)
                {
                    if (k.Key.ToLower().StartsWith("node"))
                    {
                        JsonNode? value = k.Value;
                        string? val = value?["target"]?.GetValue<string>();
                        if (val != null) return val;
                    }
                }
            }

            throw new Exception("Execution block with Node not found.");
        }

        private static void AddNodehandler(JsonNode taskNode, string nodeVersion)
        {
            AddHandler(taskNode, "prejobexecution", nodeVersion);
            AddHandler(taskNode, "execution", nodeVersion);
            AddHandler(taskNode, "postjobexecution", nodeVersion);
        }

        private static void AddHandler(JsonNode taskNode, string target, string nodeVersion)
        {
            var targetNode = taskNode[target]?.AsObject();

            if (targetNode != null && ExecutorHasNodeHandler(targetNode))
            {
                var executionPath = GetExecutionPath(taskNode, target);
                if (targetNode!.ContainsKey(nodeVersion))
                {
                    targetNode!.Remove(nodeVersion);
                }

                targetNode!.Add(nodeVersion, new JsonObject
                {
                    ["target"] = executionPath,
                    ["argumentFormat"] = ""
                });
            }
        }

        private static bool ReadVersionMap(string versionMapFile, out Dictionary<string, TaskVersion> versionMap, [NotNullWhen(returnValue: true)] out TaskVersion? maxVersion, TaskVersion? globalVersion)
        {
            versionMap = new();
            maxVersion = null;
            if (File.Exists(versionMapFile))
            {
                var lines = ensureUpdateModeVerifier!.FileReadAllLines(versionMapFile);

                foreach (var line in lines)
                {
                    var s = line.Split('|');
                    TaskVersion version = new TaskVersion(s[1]);
                    versionMap.Add(s[0], version);

                    if (maxVersion is null)
                    {
                        maxVersion = version;
                    }
                    else
                    {
                        if (version > maxVersion)
                        {
                            maxVersion = version;
                        }
                    }
                }

                if (maxVersion is null)
                {
                    throw new Exception($"expected Default version to be present in {versionMapFile}");
                }

                if (globalVersion is not null)
                {
                    TaskVersion taskGlobalVersion = maxVersion.CloneWithMinorAndPatch(globalVersion.Minor, globalVersion.Patch);
                    versionMap.Add(Config.LocalPackages.constMappingKey, taskGlobalVersion);

                    if (taskGlobalVersion > maxVersion)
                    {
                        maxVersion = taskGlobalVersion;
                    }
                }

                return true;
            }

            return false;
        }

        private static void CopyFile(string sourcePath, string targetPath)
        {
            FileInfo fi = new FileInfo(targetPath);

            if (!fi.Directory!.Exists)
            {
                ensureUpdateModeVerifier!.DirectoryCreateDirectory(fi.Directory.FullName, false);
            }

            Console.Write($"Copy from={sourcePath} to={targetPath}...");

            if (ensureUpdateModeVerifier!.FilesEqual(sourcePath, targetPath))
            {
                Console.WriteLine("files same, skipping");
            }
            else
            {
                ensureUpdateModeVerifier!.Copy(sourcePath, targetPath, true);
                Console.WriteLine("done");
            }
        }

        private static JsonNode GetNodePath(JsonNode node, string path0, params string[] path)
        {
            JsonNode ret;
            int index = 0;
            string p = path0;

            do
            {
                JsonNode? currentNode = node[p];

                if (currentNode == null)
                {
                    throw new Exception($"expected {p} at {index}, path={string.Join(',', path)}");
                }

                ret = currentNode;
                index++;

                if (index < path.Length)
                {
                    p = path[index];
                }
            } while (index < path.Length);

            return ret;
        }

    }

    internal record struct TaskStateStruct(Dictionary<Program.Config.ConfigRecord, TaskVersion> configTaskVersionMapping, HashSet<Program.Config.ConfigRecord> versionsUpdated)
    {
        public static implicit operator (Dictionary<Program.Config.ConfigRecord, TaskVersion> configTaskVersionMapping, HashSet<Program.Config.ConfigRecord> versionsUpdated)(TaskStateStruct value)
        {
            return (value.configTaskVersionMapping, value.versionsUpdated);
        }

        public static implicit operator TaskStateStruct((Dictionary<Program.Config.ConfigRecord, TaskVersion> configTaskVersionMapping, HashSet<Program.Config.ConfigRecord> versionsUpdated) value)
        {
            return new TaskStateStruct(value.configTaskVersionMapping, value.versionsUpdated);
        }
    }
}