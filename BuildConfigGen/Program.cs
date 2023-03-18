using System.Text.Json;
using System.Text.Json.Nodes;

namespace BuildConfigGen
{
    internal class Program
    {
        static readonly JsonSerializerOptions jso = new System.Text.Json.JsonSerializerOptions { WriteIndented = true };

        static class Config
        {
            public record ConfigRecord(string constMappingKey, bool isDefault, bool isNode16);

            public static readonly ConfigRecord Default = new ConfigRecord(constMappingKey: nameof(Default), isDefault: true, isNode16: false);
            public static readonly ConfigRecord Node16 = new ConfigRecord(constMappingKey: nameof(Node16), isDefault: false, isNode16: true);

            public static ConfigRecord[] Configs = { Default, Node16 };
        }

        /// <param name="task">The task to generate build configs for</param>
        static void Main(string task = "")
        {
            if (string.IsNullOrEmpty(task))
            {
                throw new Exception("task expected!");
            }

            string currentDir = Environment.CurrentDirectory;

            string gitRootPath = GitUtil.GetGitRootPath(currentDir);

            //string task = "DownloadBuildArtifactsV0";

            string taskTarget = Path.Combine(gitRootPath, "Tasks", task);
            if (!Directory.Exists(taskTarget))
            {
                throw new Exception($"expected {taskTarget} to exist!");
            }

            string taskHandler = Path.Combine(taskTarget, "task.json");
            JsonNode taskHandlerContents = JsonNode.Parse(File.ReadAllText(taskHandler))!;

            // Task may not have nodejs or packages.json (example: AutomatedAnalysisV0) 
            if (!hasNodeHandler(taskHandlerContents))
            {
                Console.WriteLine($"Skipping {task} because task doesn't have node handler does not exist");
                return;
            }

            // If target task already has node16 handlers, skip it
            if (taskHandlerContents["execution"]!["Node16"] != null)
            {
                Console.WriteLine($"Skipping {task} because it already has a Node16 handler");
                return;
            }

            UpdateVersions(gitRootPath, task, taskTarget, out var configTaskVersionMapping);

            foreach (var config in Config.Configs)
            {
                string taskOutput;
                if (config.isDefault)
                {
                    taskOutput = Path.Combine(gitRootPath, "_generated", task);
                }
                else
                {
                    taskOutput = Path.Combine(gitRootPath, "_generated", @$"{task}_{config.constMappingKey}");
                }

                CopyConfigs(taskTarget, taskOutput);

                WriteInputTaskJson(taskTarget, configTaskVersionMapping);
                WriteTaskJson(taskOutput, configTaskVersionMapping, config, "task.json");
                WriteTaskJson(taskOutput, configTaskVersionMapping, config, "task.loc.json");

                if (config.isNode16)
                {
                    WriteNode16PackageJson(taskOutput);
                }
            }
        }

        private static void WriteTaskJson(string taskPath, Dictionary<Config.ConfigRecord, TaskVersion> configTaskVersionMapping, Config.ConfigRecord config, string path2)
        {
            string outputTaskPath = Path.Combine(taskPath, path2);
            JsonNode outputTaskNode = JsonNode.Parse(File.ReadAllText(outputTaskPath))!;
            outputTaskNode["version"]!["Patch"] = configTaskVersionMapping[config].Patch;
            outputTaskNode.AsObject()?.Remove("_buildConfigMapping");

            JsonObject configMapping = new JsonObject();
            foreach (var cfg in configTaskVersionMapping)
            {
                configMapping.Add(new(cfg.Key.constMappingKey, cfg.Value.ToString()));
            }

            if (config.isNode16)
            {
                AddNode16handler(outputTaskNode);
            }

            File.WriteAllText(outputTaskPath, outputTaskNode.ToJsonString(jso));
        }

        private static void WriteNode16PackageJson(string taskOutputNode16)
        {
            string outputNode16PackagePath = Path.Combine(taskOutputNode16, "package.json");
            JsonNode outputNod16PackagePath = JsonNode.Parse(File.ReadAllText(outputNode16PackagePath))!;
            outputNod16PackagePath["dependencies"]!["@types/node"] = "^16.11.39";
            File.WriteAllText(outputNode16PackagePath, outputNod16PackagePath.ToJsonString(jso));
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
   
        private static void CopyConfigs(string taskTarget, string taskOutput)
        {
            var paths = GitUtil.GetNonIgnoredFileListFromPath(taskTarget);
            var targetPaths = new HashSet<string>(GitUtil.GetNonIgnoredFileListFromPath(taskOutput));

            foreach (var o in paths)
            {
                //Console.WriteLine(o);
                string sourcePath = Path.Combine(taskTarget, o);
                string targetPath = Path.Combine(taskOutput, o);
                _ = targetPaths.Remove(o);

                CopyFile(sourcePath, targetPath);
            }

            foreach (var b in targetPaths)
            {
                string targetPath = Path.Combine(taskOutput, b);
                Console.WriteLine($"Adding .tmp extension to extra file in output directory (should cause it to be ignored by .gitignore): {b}");

                string destFileName = targetPath + ".tmp";
                if (File.Exists(destFileName))
                {
                    throw new Exception($"{destFileName} already exists; please clean up");
                }
                File.Move(targetPath, destFileName);

            }
        }

        private static void UpdateVersions(string gitRootPath, string task, string taskTarget, out Dictionary<Config.ConfigRecord, TaskVersion> configTaskVersionMapping)
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
            foreach (var config in Config.Configs)
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

                foreach (var config in Config.Configs)
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

            WriteVersionMapFile(versionMapFile, configTaskVersionMapping);
        }

        private static TaskVersion GetInputVersion(string taskTarget)
        {
            Int32 patch;
            TaskVersion inputVersion;

            string inputTaskPath = Path.Combine(taskTarget, "task.json");
            JsonNode inputTaskNode = JsonNode.Parse(File.ReadAllText(inputTaskPath))!;

            Int32 major;
            Int32 minor;

            // Need to parse it to a int because the version can be a string or an int (example: AzureStaticWebAppV0)
            Int32.TryParse(inputTaskNode["version"]!["Major"]!.ToString(), out major);
            Int32.TryParse(inputTaskNode["version"]!["Minor"]!.ToString(), out minor);
            Int32.TryParse(inputTaskNode["version"]!["Patch"]!.ToString(), out patch);

            inputVersion = new(major, minor, patch);

            return inputVersion;
        }

        private static void WriteInputTaskJson(string taskTarget, Dictionary<Config.ConfigRecord, TaskVersion> configTaskVersion)
        {
            string inputTaskPath = Path.Combine(taskTarget, "task.json");
            JsonNode inputTaskNode = JsonNode.Parse(File.ReadAllText(inputTaskPath))!;

            inputTaskNode["version"]!["Patch"] = configTaskVersion[Config.Default].Patch;

            File.WriteAllText(inputTaskPath, inputTaskNode.ToJsonString(jso));
        }

        private static void WriteVersionMapFile(string versionMapFile, Dictionary<Config.ConfigRecord, TaskVersion> configTaskVersion)
        {
            using (var fs = File.Open(versionMapFile, FileMode.Create))
            {
                using (var sw = new StreamWriter(fs))
                {
                    foreach (var config in Config.Configs)
                    {
                        sw.WriteLine(string.Concat(config.constMappingKey, "|", configTaskVersion[config]));
                    }
                }
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

        private static void AddNode16handler(JsonNode taskNode)
        {
            taskNode["prejobexecution"]?.AsObject().Add("Node16", new JsonObject
            {
                ["target"] = GetExecutionPath(taskNode, "prejobexecution"),
                ["argumentFormat"] = ""
            });

            taskNode["execution"]?.AsObject().Add("Node16", new JsonObject
            {
                ["target"] = GetExecutionPath(taskNode, "execution"),
                ["argumentFormat"] = ""
            });

            taskNode["postjobexecution"]?.AsObject().Add("Node16", new JsonObject
            {
                ["target"] = GetExecutionPath(taskNode, "postjobexecution"),
                ["argumentFormat"] = ""
            });
        }

        private static void ReadVersionMap(string versionMapFile, out Dictionary<string, TaskVersion> versionMap, out TaskVersion? maxVersion)
        {
            versionMap = new();
            maxVersion = null;
            if (File.Exists(versionMapFile))
            {
                var lines = File.ReadAllLines(versionMapFile);

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
                fi.Directory!.Create();
            }

            Console.Write($"Copy from={sourcePath} to={targetPath}...");

            if (FilesEqual(sourcePath, targetPath))
            {
                Console.WriteLine("files same, skipping");
            }
            else
            {
                File.Copy(sourcePath, targetPath, true);
                Console.WriteLine("done");
            }

        }

        private static bool FilesEqual(string sourcePath, string targetPath)
        {
            FileInfo fi = new FileInfo(sourcePath);
            FileInfo fi2 = new FileInfo(targetPath);

            if (!fi2.Exists)
            {
                return false;
            }

            if (fi.Length != fi2.Length)
            {
                return false;
            }

            byte[] buffer = new byte[4096 * 255];
            byte[] buffer2 = new byte[4096 * 255];
            using (var fs1 = fi.Open(FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
            {
                using (var fs2 = fi2.Open(FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                {
                    int read;
                    read = fs1.Read(buffer, 0, buffer.Length);
                    if (read != fs2.Read(buffer2, 0, buffer2.Length))
                    {
                        throw new Exception("unexpected number of bytes read from second file");
                    }

                    for (int i = 0; i < read; i++)
                    {
                        if (buffer[i] != buffer2[i])
                        {
                            return false;
                        }
                    }

                }
            }

            return true;
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