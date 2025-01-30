using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

class CheckDowngrading
{
    private static readonly string TaskVersionBumpingDocUrl = "https://aka.ms/azp-tasks-version-bumping";
    private static readonly string PackageEndpoint = Environment.GetEnvironmentVariable("PACKAGE_VERSIONS_ENDPOINT");
    private static readonly string SourceBranch = EscapeHash(Environment.GetEnvironmentVariable("SYSTEM_PULLREQUEST_SOURCEBRANCH"));
    private static readonly string TargetBranch = EscapeHash(Environment.GetEnvironmentVariable("SYSTEM_PULLREQUEST_TARGETBRANCH"));
    private static readonly string BaseProjectPath = Path.Combine(AppContext.BaseDirectory, "..");
    private static readonly string TempMasterTasksPath = Path.Combine(BaseProjectPath, "temp", "tasks-versions", TargetBranch);

    public static async Task LocalMain(string[] args)
    {

        // An example:
        // PACKAGE_TOKEN={token} PACKAGE_VERSIONS_ENDPOINT={package_versions_endpoint} SYSTEM_PULLREQUEST_SOURCEBRANCH=refs/head/{local_branch_name} SYSTEM_PULLREQUEST_TARGETBRANCH={target_branch_eg_master} node ./ci/check-downgrading.js --task "@({tasks_names})" --sprint {current_sprint_number}

        if (string.IsNullOrEmpty(PackageEndpoint))
        {
            LogToPipeline("error", "Failed to get info from package endpoint because no endpoint was specified. Try setting the PACKAGE_VERSIONS_ENDPOINT environment variable.");
            Environment.Exit(1);
        }

        var argv = ConvertArgsArrayToDictionary(args);
        var task = argv["task"];
        if (string.IsNullOrEmpty(task))
        {
            Console.WriteLine("$(task_pattern)variable is empty or not set. Aborting...");
            Environment.Exit(0);
        }

        if (!Directory.Exists(TempMasterTasksPath))
        {
            Directory.CreateDirectory(TempMasterTasksPath);
        }

        if (Directory.Exists(Path.Combine(TempMasterTasksPath, "Tasks")))
        {
            Directory.Delete(Path.Combine(TempMasterTasksPath, "Tasks"), true);
        }

        await Main2(argv, task);
    }

    private static Dictionary<string, string> ConvertArgsArrayToDictionary(string[] args)
    {
        var dictionary = new Dictionary<string, string>();
        for (int i = 0; i < args.Length; i += 2)
        {
            if (i + 1 < args.Length)
            {
                dictionary[args[i].TrimStart('-')] = args[i + 1];
            }
        }
        return dictionary;
    }

    private static string EscapeHash(string str)
    {
        return Environment.OSVersion.Platform == PlatformID.Win32NT ? str : str.Replace("#", "\\#");
    }

    private static void LogToPipeline(string type, string payload)
    {
        Console.WriteLine($"{type}: {payload}");
    }

    private static List<string> ResolveTaskList(string task)
    {
        // Implement the logic to resolve the task list
        return new List<string>();
    }


    private static List<Message> CompareVersionMapFilesToDefaultBranch()
    {
        var messages = new List<Message>();
        var defaultBranch = "origin/master";

        var modifiedVersionMapFiles = GetModifiedVersionMapFiles(defaultBranch, SourceBranch);
        if (modifiedVersionMapFiles.Count == 0) return messages;

        foreach (var filePath in modifiedVersionMapFiles)
        {
            var taskName = Path.GetFileNameWithoutExtension(filePath);

            try
            {
                var defaultBranchVersionMap = ParseVersionMap(GetVersionMapContent(filePath, defaultBranch));
                var sourceBranchVersionMap = ParseVersionMap(GetVersionMapContent(filePath, SourceBranch));

                CheckVersionMapUpdate(defaultBranchVersionMap, sourceBranchVersionMap);
            }
            catch (Exception ex)
            {
                messages.Add(new Message
                {
                    Type = "error",
                    Payload = $"Task Name: {taskName}. Please check {filePath}. {ex.Message}"
                });
            }
        }

        return messages;
    }


    private static string FindMaxConfigVersion(Dictionary<string, string> versionMap)
    {
        var maxVersion = new Version("0.0.0");
        foreach (var config in versionMap)
        {
            var version = Version.Parse(config.Value);
            if (version > maxVersion)
            {
                maxVersion = version;
            }
        }
        return maxVersion.ToString();
    }



    private static void CheckVersionMapUpdate(Dictionary<string, string> defaultBranchConfig, Dictionary<string, string> sourceBranchConfig)
    {
        var defaultBranchMaxVersion = FindMaxConfigVersion(defaultBranchConfig);

        foreach (var config in sourceBranchConfig)
        {
            if (Version.Parse(config.Value) <= Version.Parse(defaultBranchMaxVersion))
            {
                throw new Exception($"New versions of the task should be greater than the previous max version. {config.Key} | {config.Value} should be greater than {defaultBranchMaxVersion}");
            }
        }
    }

    private static List<string> GetModifiedVersionMapFiles(string defaultBranch, string sourceBranch)
    {
        var versionMapPathRegex = new Regex(@"_generated\/.*versionmap.txt$");
        var versionMapFiles = Run($"git --no-pager diff --name-only --diff-filter=M {defaultBranch}...{sourceBranch}")
            .Split('\n')
            .Where(line => versionMapPathRegex.IsMatch(line))
            .ToList();
        return versionMapFiles;
    }

    private static string GetVersionMapContent(string versionMapFilePath, string branchName)
    {
        return Run($"git show {branchName}:{versionMapFilePath}");
    }

    private static Dictionary<string, string> ParseVersionMap(string fileContent)
    {
        var simpleVersionMapRegex = new Regex(@"(?<configName>.+)\|(?<version>\d+\.\d+\.\d+)$");
        var versionMap = new Dictionary<string, string>();
        foreach (var line in fileContent.Split('\n'))
        {
            if (simpleVersionMapRegex.IsMatch(line))
            {
                var match = simpleVersionMapRegex.Match(line);
                versionMap[match.Groups["configName"].Value] = match.Groups["version"].Value;
            }
            else
            {
                throw new Exception($"Unable to parse version map {line}");
            }
        }
        return versionMap;
    }




    private static List<Message> CheckMasterVersions(List<TaskVersion> masterTasks, int sprint, bool isReleaseTagExist, bool isCourtesyWeek)
    {
        var messages = new List<Message>();

        foreach (var masterTask in masterTasks)
        {
            if (masterTask.Version.Minor <= sprint)
            {
                continue;
            }

            if (isReleaseTagExist || isCourtesyWeek)
            {
                continue;
            }

            messages.Add(new Message
            {
                Type = "warning",
                Payload = $"[{TargetBranch}] {masterTask.Name} has v{masterTask.Version} it's higher than the current sprint {sprint}"
            });
        }

        return messages;
    }

    private static List<Message> CompareLocalToMaster(List<TaskVersion> localTasks, List<TaskVersion> masterTasks, int sprint)
    {
        var messages = new List<Message>();

        foreach (var localTask in localTasks)
        {
            var masterTask = masterTasks.FirstOrDefault(x => x.Name.Equals(localTask.Name, StringComparison.OrdinalIgnoreCase));

            if (masterTask == null)
            {
                continue;
            }

            if (localTask.Version.Minor < sprint)
            {
                var destinationVersion = new Version(masterTask.Version.Major, sprint, masterTask.Version.Build);

                messages.Add(new Message
                {
                    Type = "error",
                    Payload = $"{localTask.Name} have to be upgraded(task.json, task.loc.json) from v{localTask.Version} to v{destinationVersion} at least since local minor version is less than the sprint version({TaskVersionBumpingDocUrl})"
                });
                continue;
            }

            if (localTask.Version.Minor == sprint && localTask.Version == masterTask.Version)
            {
                messages.Add(new Message
                {
                    Type = "error",
                    Payload = $"{localTask.Name} have to be upgraded(task.json, task.loc.json) from v{localTask.Version} to v{new Version(masterTask.Version.Major, masterTask.Version.Minor, masterTask.Version.Build + 1)} at least since local version is equal to the master version({TaskVersionBumpingDocUrl})"
                });
                continue;
            }
        }

        return messages;
    }

    private static List<Message> CheckLocalVersions(List<TaskVersion> localTasks, int sprint, bool isReleaseTagExist, bool isCourtesyWeek)
    {
        var messages = new List<Message>();

        foreach (var localTask in localTasks)
        {
            if (localTask.Version.Minor < sprint)
            {
                messages.Add(new Message
                {
                    Type = "error",
                    Payload = $"{localTask.Name} have to be upgraded(task.json, task.loc.json) from v{localTask.Version.Minor} to v{sprint} at least since local minor version is less than the sprint version({TaskVersionBumpingDocUrl})"
                });
                continue;
            }

            if (localTask.Version.Minor == sprint && isCourtesyWeek)
            {
                messages.Add(new Message
                {
                    Type = "warning",
                    Payload = $"Be careful with task {localTask.Name} version and check it attentively as the current week is courtesy push week"
                });
                continue;
            }

            if (localTask.Version.Minor > sprint && (!isReleaseTagExist && !isCourtesyWeek))
            {
                messages.Add(new Message
                {
                    Type = "error",
                    Payload = $"[{SourceBranch}] {localTask.Name} has v{localTask.Version} it's higher than the current sprint {sprint} ({TaskVersionBumpingDocUrl})"
                });
                continue;
            }
        }

        return messages;
    }

    private static List<TaskVersion> ReadVersionsFromTaskJsons(List<string> tasks, string basepath)
    {
        return tasks.Select(x =>
        {
            var taskJSONPath = Path.Combine(basepath, "Tasks", x, "task.json");

            if (!File.Exists(taskJSONPath))
            {
                LogToPipeline("error", $"Task.json of {x} does not exist by path {taskJSONPath}");
                Environment.Exit(1);
            }

            var taskJSONObject = JsonNode.Parse(File.ReadAllText(taskJSONPath));
            return new TaskVersion
            {
                Id = taskJSONObject["id"].ToString(),
                Name = x,
                Version = new Version(
                    (int)taskJSONObject["version"]["Major"],
                    (int)taskJSONObject["version"]["Minor"],
                    (int)taskJSONObject["version"]["Patch"]
                )
            };
        }).ToList();
    }

    private static async Task<List<FeedTaskVersion>> GetTaskVersionsFromFeed()
    {
        using (var httpClient = new HttpClient())
        {
            var response = await httpClient.GetAsync(PackageEndpoint);

            if (!response.IsSuccessStatusCode)
            {
                LogToPipeline("error", $"Failed while fetching feed versions.\nStatus code: {response.StatusCode}\nResult: {await response.Content.ReadAsStringAsync()}");
                Environment.Exit(1);
            }

            var result = JsonNode.Parse(await response.Content.ReadAsStringAsync());
            
            return result.AsArray().Select(x => new FeedTaskVersion
            {
                Name = x["name"].ToString().Substring("Mseng.MS.TF.DistributedTask.Tasks.".Length),
                Versions = x["versions"].AsArray().Select(y => new TaskVersion
                {
                    Version = Version.Parse(y["version"].ToString()),
                    IsLatest = (bool)y["isLatest"]
                }).ToList()
            }).ToList();
        }
    }

    private static List<Message> CompareLocalToFeed(List<TaskVersion> localTasks, List<FeedTaskVersion> feedTasks, int sprint)
    {
        var messages = new List<Message>();

        foreach (var localTask in localTasks)
        {
            var feedTask = feedTasks.FirstOrDefault(x => x.Name.Equals(localTask.Name, StringComparison.OrdinalIgnoreCase));

            if (feedTask == null)
            {
                continue;
            }

            foreach (var feedTaskVersion in feedTask.Versions)
            {
                if (feedTaskVersion.Version.Minor > sprint)
                {
                    messages.Add(new Message
                    {
                        Type = "warning",
                        Payload = $"[Feed] {feedTask.Name} has v{feedTaskVersion.Version} it's higher than the current sprint {sprint}"
                    });
                    continue;
                }

                if (localTask.Version <= feedTaskVersion.Version && feedTaskVersion.IsLatest)
                {
                    messages.Add(new Message
                    {
                        Type = "warning",
                        Payload = $"[Feed] {localTask.Name} local version {localTask.Version} less or equal than version in feed {feedTaskVersion.Version}"
                    });
                }
            }
        }

        return messages;
    }


    private static List<Message> CompareLocalTaskLoc(List<TaskVersion> localTasks)
    {
        var messages = new List<Message>();

        foreach (var localTask in localTasks)
        {
            var taskLocJSONPath = Path.Combine(AppContext.BaseDirectory, "..", "Tasks", localTask.Name, "task.loc.json");

            if (!File.Exists(taskLocJSONPath))
            {
                LogToPipeline("error", $"Task.json of {localTask.Name} does not exist by path {taskLocJSONPath}");
                Environment.Exit(1);
            }

            var taskLocJSONObject = JsonNode.Parse(File.ReadAllText(taskLocJSONPath));
            var taskLocJSONVersion = new Version(
                (int)taskLocJSONObject["version"]["Major"],
                (int)taskLocJSONObject["version"]["Minor"],
                (int)taskLocJSONObject["version"]["Patch"]
            );

            if (localTask.Version != taskLocJSONVersion)
            {
                messages.Add(new Message
                {
                    Type = "error",
                    Payload = $"[Loc] {localTask.Name} task.json v{localTask.Version} does not match with task.loc.json v{taskLocJSONVersion} ({TaskVersionBumpingDocUrl})"
                });
            }
        }

        return messages;
    }

    private static void LoadTaskJsonsFromMaster(List<string> names)
    {
        foreach (var name in names)
        {
            Directory.CreateDirectory(Path.Combine(TempMasterTasksPath, "Tasks", name));
            Run($"git show origin/master:Tasks/{name}/task.json > {Path.Combine(TempMasterTasksPath, "Tasks", name, "task.json").Replace(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)}");
        }
    }

    private static bool DoesTaskExistInMasterBranch(string name)
    {
        try
        {
            Run($"git cat-file -e origin/master:Tasks/{name}/task.json", true);
        }
        catch
        {
            return false;
        }
        return true;
    }


    private static async Task Main2(Dictionary<string,string> argv, string task)
    {
        var taskList = ResolveTaskList(task);
        var localTasks = ReadVersionsFromTaskJsons(taskList, Path.Combine(AppContext.BaseDirectory, ".."));
        var masterTaskList = taskList.Where(DoesTaskExistInMasterBranch).ToList();
        LoadTaskJsonsFromMaster(masterTaskList);
        var masterTasks = ReadVersionsFromTaskJsons(masterTaskList, TempMasterTasksPath);
        var feedTaskVersions = await GetTaskVersionsFromFeed();
        var isReleaseTagExist = Run($"git tag -l v{argv["sprint"]}").Length != 0;
        var isCourtesyWeek = argv["week"] == "3";

        var messages = new List<Message>();
        messages.AddRange(CheckMasterVersions(masterTasks, int.Parse(argv["sprint"]), isReleaseTagExist, isCourtesyWeek));
        messages.AddRange(CompareLocalToMaster(localTasks, masterTasks, int.Parse(argv["sprint"])));
        messages.AddRange(CheckLocalVersions(localTasks, int.Parse(argv["sprint"]), isReleaseTagExist, isCourtesyWeek));
        messages.AddRange(CompareLocalToFeed(localTasks, feedTaskVersions, int.Parse(argv["sprint"])));
        messages.AddRange(CompareLocalTaskLoc(localTasks));
        messages.AddRange(CompareVersionMapFilesToDefaultBranch());

        if (messages.Count > 0)
        {
            Console.WriteLine($"\nProblems with {messages.Count} task(s) should be resolved:\n");

            foreach (var message in messages)
            {
                LogToPipeline(message.Type, message.Payload);
            }

            Console.WriteLine("\nor you might have an outdated branch, try to merge/rebase your branch from master");

            if (messages.Any(x => x.Type == "error"))
            {
                Environment.Exit(1);
            }
        }
    }

    private static string Run(string command, bool throwOnError = false)
    {
        try
        {
            var processInfo = new ProcessStartInfo("cmd.exe", "/c " + command)
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using (var process = Process.Start(processInfo))
            {
                var output = process.StandardOutput.ReadToEnd();
                var error = process.StandardError.ReadToEnd();
                process.WaitForExit();

                if (process.ExitCode != 0 && throwOnError)
                {
                    throw new Exception($"Command '{command}' failed with exit code {process.ExitCode}: {error}");
                }

                return output;
            }
        }
        catch (Exception ex)
        {
            if (throwOnError)
            {
                throw;
            }

            LogToPipeline("error", ex.Message);
            return string.Empty;
        }
    }

    private class TaskVersion
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public Version Version { get; set; }
        public bool IsLatest { get; set; }
    }

    private class FeedTaskVersion
    {
        public string Name { get; set; }
        public List<TaskVersion> Versions { get; set; }
    }

    private class Message
    {
        public string Type { get; set; }
        public string Payload { get; set; }
    }
}
