using System.Diagnostics.CodeAnalysis;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

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

        static class Config
        {
            public static readonly string[] ExtensionsToPreprocess = new[] { ".ts", ".json" };

            public record ConfigRecord(string name, string constMappingKey, bool isDefault, bool isNode16, bool isWif, string preprocessorVariableName, bool enableBuildConfigOverrides);

            public static readonly ConfigRecord Default = new ConfigRecord(name: nameof(Default), constMappingKey: "Default", isDefault: true, isNode16: false, isWif: false, preprocessorVariableName: "DEFAULT", enableBuildConfigOverrides: false);
            public static readonly ConfigRecord Node16 = new ConfigRecord(name: nameof(Node16), constMappingKey: "Node16-219", isDefault: false, isNode16: true, isWif: false, preprocessorVariableName: "NODE16", enableBuildConfigOverrides: true);
            public static readonly ConfigRecord WorkloadIdentityFederation = new ConfigRecord(name: nameof(WorkloadIdentityFederation), constMappingKey: "WorkloadIdentityFederation", isDefault: false, isNode16: true, isWif: true, preprocessorVariableName: "WORKLOADIDENTITYFEDERATION", enableBuildConfigOverrides: true);

            public static ConfigRecord[] Configs = { Default, Node16, WorkloadIdentityFederation };
        }

        // ensureUpdateModeVerifier wraps all writes.  if writeUpdate=false, it tracks writes that would have occured
        static EnsureUpdateModeVerifier? ensureUpdateModeVerifier;

        /// <param name="task">The task to generate build configs for</param>
        /// <param name="configs">List of configs to generate seperated by |</param>
        /// <param name="writeUpdates">Write updates if true, else validate that the output is up-to-date</param>
        static void Main(string task, string configs, bool writeUpdates = false)
        {
            // error handling strategy:
            // 1. design: anything goes wrong, try to detect and crash as early as possible to preserve the callstack to make debugging easier.
            // 2. we allow all exceptions to fall though.  Non-zero exit code will be surfaced
            // 3. Ideally default windows exception will occur and errors reported to WER/watson.  I'm not sure this is happening, perhaps DragonFruit is handling the exception

            foreach (var t in task.Split(','))
            {
                Main3(t, configs, writeUpdates);
            }
        }

        private static void Main3(string task, string configsString, bool writeUpdates)
        {
            if (string.IsNullOrEmpty(task))
            {
                throw new Exception("task expected!");
            }

            if (string.IsNullOrEmpty(configsString))
            {
                throw new Exception("configs expected!");
            }

            string[] configs = configsString.Split("|");

            Dictionary<string, Config.ConfigRecord> configdefs = new(Config.Configs.Where(x => !x.isDefault).Select(x => new KeyValuePair<string, Config.ConfigRecord>(x.name, x)));
            HashSet<Config.ConfigRecord> targetConfigs = new HashSet<Config.ConfigRecord>();
            targetConfigs.Add(Config.Default);
            foreach (var config in configs)
            {
                if (configdefs.TryGetValue(config, out var matchedConfig))
                {
                    targetConfigs.Add(matchedConfig);
                }
                else
                {
                    string configsList = "Configs specified must be one of: " + string.Join(',', Config.Configs.Where(x=>!x.isDefault).Select(x => x.name));
                    throw new Exception(configsList);
                }
            }

            try
            {
                ensureUpdateModeVerifier = new EnsureUpdateModeVerifier(!writeUpdates);

                Main2(task, targetConfigs);

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

                throw new Exception($"Updates needed, please run BuildConfigGen  --task {task} --write-updates");
            }
        }

        private static void Main2(string task, HashSet<Config.ConfigRecord> targetConfigs)
        {
            string currentDir = Environment.CurrentDirectory;

            string gitRootPath = GitUtil.GetGitRootPath(currentDir);

            string taskTargetPath = Path.Combine(gitRootPath, "Tasks", task);
            if (!Directory.Exists(taskTargetPath))
            {
                throw new Exception($"expected {taskTargetPath} to exist!");
            }

            string taskHandler = Path.Combine(taskTargetPath, "task.json");
            JsonNode taskHandlerContents = JsonNode.Parse(ensureUpdateModeVerifier!.FileReadAllText(taskHandler))!;

            if (targetConfigs.Any(x => x.isNode16))
            {
                // Task may not have nodejs or packages.json (example: AutomatedAnalysisV0) 
                if (!hasNodeHandler(taskHandlerContents))
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

            UpdateVersions(gitRootPath, task, taskTargetPath, out var configTaskVersionMapping, targetConfigs: targetConfigs);

            foreach (var config in targetConfigs)
            {
                string taskOutput;
                if (config.isDefault)
                {
                    taskOutput = Path.Combine(gitRootPath, "_generated", task);
                }
                else
                {
                    taskOutput = Path.Combine(gitRootPath, "_generated", @$"{task}_{config.name}");
                }

                if (config.enableBuildConfigOverrides)
                {
                    EnsureBuildConfigFileOverrides(config, taskTargetPath);
                }

                CopyConfig(taskTargetPath, taskOutput, skipPathName: buildConfigs, skipFileName: null, removeExtraFiles: true, throwIfNotUpdatingFileForApplyingOverridesAndPreProcessor: false, config: config, allowPreprocessorDirectives: true);



                if (config.enableBuildConfigOverrides)
                {
                    CopyConfigOverrides(taskTargetPath, taskOutput, config);
                }

                // if some files aren't present in destination, stop as following code assumes they're present and we'll just get a FileNotFoundException
                // don't check content as preprocessor hasn't run
                ThrowWithUserFriendlyErrorToRerunWithWriteUpdatesIfVeriferError(task, skipContentCheck: true);

                HandlePreprocessingInTarget(taskOutput, config);

                WriteInputTaskJson(taskTargetPath, configTaskVersionMapping, "task.json");
                WriteInputTaskJson(taskTargetPath, configTaskVersionMapping, "task.loc.json");
                WriteTaskJson(taskOutput, configTaskVersionMapping, config, "task.json");
                WriteTaskJson(taskOutput, configTaskVersionMapping, config, "task.loc.json");

                if (config.isNode16)
                {
                    WriteNode16PackageJson(taskOutput);
                }
            }
        }


        private static void EnsureBuildConfigFileOverrides(Config.ConfigRecord config, string taskTargetPath)
        {
            if(!config.enableBuildConfigOverrides)
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
            if (!config.enableBuildConfigOverrides)
            {
                throw new Exception("BUG: should not get here: !config.enableBuildConfigOverrides");
            }

            path = Path.Combine(taskTargetPath, buildConfigs, config.name);
            readmeFile = Path.Combine(taskTargetPath, buildConfigs, config.name, filesOverriddenForConfigGoHereReadmeTxt);
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

        private static void HandlePreprocessingInTarget(string taskOutput, Config.ConfigRecord config)
        {
            var nonIgnoredFilesInTarget = new HashSet<string>(GitUtil.GetNonIgnoredFileListFromPath(taskOutput));

            foreach (var file in nonIgnoredFilesInTarget)
            {
                string taskOutputFile = Path.Combine(taskOutput, file);

                PreprocessIfExtensionEnabledInConfig(taskOutputFile, config, validateAndWriteChanges: true, out _);
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
                    if (!config.enableBuildConfigOverrides)
                    {
                        throw new Exception("BUG: should not get here: !config.enableBuildConfigOverrides");
                    }

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

            if (config.isNode16)
            {
                AddNode16handler(outputTaskNode);
            }

            ensureUpdateModeVerifier!.WriteAllText(outputTaskPath, outputTaskNode.ToJsonString(jso), suppressValidationErrorIfTargetPathDoesntExist: false);
        }

        private static void WriteNode16PackageJson(string taskOutputNode16)
        {
            string outputNode16PackagePath = Path.Combine(taskOutputNode16, "package.json");
            JsonNode outputNod16PackagePath = JsonNode.Parse(ensureUpdateModeVerifier!.FileReadAllText(outputNode16PackagePath))!;
            outputNod16PackagePath["dependencies"]!["@types/node"] = "^16.11.39";
            ensureUpdateModeVerifier!.WriteAllText(outputNode16PackagePath, outputNod16PackagePath.ToJsonString(jso), suppressValidationErrorIfTargetPathDoesntExist: false);
        }

        private static bool hasNodeHandler(JsonNode taskHandlerContents)
        {
            var handlers = taskHandlerContents["execution"]?.AsObject();
            bool hasNodeHandler = false;
            if (handlers == null) { return false; }

            foreach (var k in handlers)
            {
                if (k.Key.ToLower().StartsWith("node"))
                {
                    hasNodeHandler = true;
                    break;
                }
            }
            return hasNodeHandler;
        }

        private static void CopyConfig(string taskTarget, string taskOutput, string? skipPathName, string? skipFileName, bool removeExtraFiles, bool throwIfNotUpdatingFileForApplyingOverridesAndPreProcessor, Config.ConfigRecord config, bool allowPreprocessorDirectives)
        {
            var paths = GitUtil.GetNonIgnoredFileListFromPath(taskTarget);

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

            foreach (var path in paths)
            {
                string sourcePath = Path.Combine(taskTarget, path);

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

                    PreprocessIfExtensionEnabledInConfig(sourcePath, config, validateAndWriteChanges: false, out bool hasPreprocessorDirectives);

                    if (hasPreprocessorDirectives)
                    {
                        throw new Exception($"Preprocessor directives not supported in files in _buildConfigs sourcePath={sourcePath}");
                    }
                }

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
        }

        private static void UpdateVersions(string gitRootPath, string task, string taskTarget, out Dictionary<Config.ConfigRecord, TaskVersion> configTaskVersionMapping, HashSet<Config.ConfigRecord> targetConfigs)
        {
            Dictionary<string, TaskVersion> versionMap;
            TaskVersion? maxVersion;

            string versionMapFile = Path.Combine(gitRootPath, "_generated", @$"{task}.versionmap.txt");

            ReadVersionMap(versionMapFile, out versionMap, out maxVersion);

            var inputVersion = GetInputVersion(taskTarget);

            if (!(maxVersion is null) && inputVersion < maxVersion)
            {
                throw new Exception($"version specified in task {taskTarget} must not be less than maxversion {maxVersion} specified in {versionMapFile}");
            }

            configTaskVersionMapping = new();

            // copy the mappings.  As we go check if any configs not mapped. If so, invalidate.
            bool allConfigsMappedAndValid = true;
            foreach (var config in targetConfigs)
            {
                if (versionMap.ContainsKey(config.constMappingKey))
                {
                    configTaskVersionMapping.Add(config, versionMap[config.constMappingKey]);
                }
                else
                {
                    allConfigsMappedAndValid = false;
                }
            }

            // invalidate if input version is not the default version specified in mapping
            if (allConfigsMappedAndValid)
            {
                if (inputVersion == configTaskVersionMapping[Config.Default])
                {

                }
                else
                {
                    allConfigsMappedAndValid = false;
                }
            }

            int c = 0;
            if (!allConfigsMappedAndValid)
            {
                configTaskVersionMapping.Clear();

                foreach (var config in targetConfigs)
                {
                    if (!config.isDefault)
                    {
                        configTaskVersionMapping.Add(config, inputVersion.CloneWithPatch(inputVersion.Patch + c));
                        c++;
                    }
                }

                // ensure version goes last
                configTaskVersionMapping.Add(Config.Default, inputVersion.CloneWithPatch(inputVersion.Patch + c));
            }

            WriteVersionMapFile(versionMapFile, configTaskVersionMapping, targetConfigs: targetConfigs);
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

            inputTaskNode["version"]!["Major"] = configTaskVersion[Config.Default].Major;
            inputTaskNode["version"]!["Minor"] = configTaskVersion[Config.Default].Minor;
            inputTaskNode["version"]!["Patch"] = configTaskVersion[Config.Default].Patch;

            ensureUpdateModeVerifier!.WriteAllText(inputTaskPath, inputTaskNode.ToJsonString(jso), suppressValidationErrorIfTargetPathDoesntExist: false);
        }

        private static void WriteVersionMapFile(string versionMapFile, Dictionary<Config.ConfigRecord, TaskVersion> configTaskVersion, HashSet<Config.ConfigRecord> targetConfigs)
        {
            StringBuilder sb = new StringBuilder();
            using (var sw = new StringWriter(sb))
            {
                foreach (var config in targetConfigs)
                {
                    sw.WriteLine(string.Concat(config.constMappingKey, "|", configTaskVersion[config]));
                }
            }

            ensureUpdateModeVerifier!.WriteAllText(versionMapFile, sb.ToString(), suppressValidationErrorIfTargetPathDoesntExist: false);
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

        private static void AddNode16handler(JsonNode taskNode)
        {
            AddHandler(taskNode, "prejobexecution");
            AddHandler(taskNode, "execution");
            AddHandler(taskNode, "postjobexecution");
        }

        private static void AddHandler(JsonNode taskNode, string target)
        {
            var targetNode = taskNode[target]?.AsObject();

            if (targetNode != null)
            {
                if (targetNode!.ContainsKey("Node16"))
                {
                    targetNode!.Remove("Node16");
                }

                targetNode!.Add("Node16", new JsonObject
                {
                    ["target"] = GetExecutionPath(taskNode, target),
                    ["argumentFormat"] = ""
                });
            }
        }

        private static void ReadVersionMap(string versionMapFile, out Dictionary<string, TaskVersion> versionMap, out TaskVersion? maxVersion)
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
            }
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
}