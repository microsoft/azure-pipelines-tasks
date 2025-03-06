// Filter out tasks that don't need to be built. Determines which tasks need to be built based on the type of build.
// If its a CI build, all tasks whose package numbers have been bumped will be built.
// If its a PR build, all tasks that have been changed will be built.
// Any other type of build will build all tasks.

using System;
using System.Linq;
using System.Text.Json.Nodes;

public class FilterTasksUtil
{
    private static readonly string makeOptionsPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "make-options.json");
    private static readonly JsonNode makeOptions = JsonNode.Parse(File.ReadAllText(makeOptionsPath));
    private static readonly HttpClient client = new HttpClient();

    private static async Task<List<string>> GetTasksToBuildForCI()
    {
        JsonNode packageInfo;
        try
        {
            var packageToken = Environment.GetEnvironmentVariable("PACKAGE_TOKEN");
            if (string.IsNullOrEmpty(packageToken))
            {
                Console.WriteLine("Failed to get info from package endpoint because no token was provided. Try setting the PACKAGE_TOKEN environment variable.");
                return GetTaskArray(makeOptions);
            }

            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {packageToken}");
            var packageEndpoint = Environment.GetEnvironmentVariable("PACKAGE_ENDPOINT");
            if (string.IsNullOrEmpty(packageEndpoint))
            {
                Console.WriteLine("Failed to get info from package endpoint because no endpoint was specified. Try setting the PACKAGE_ENDPOINT environment variable.");
                return GetTaskArray(makeOptions);
            }

            var response = await client.GetAsync(packageEndpoint);
            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"Failed to get info from package endpoint, returned with status code {response.StatusCode}");
                return GetTaskArray(makeOptions);
            }

            packageInfo = JsonNode.Parse(await response.Content.ReadAsStringAsync());
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to get info from package endpoint, client failed with error {ex.Message}");
            return GetTaskArray(makeOptions);
        }

        var packageMap = new Dictionary<string, string>();
        if (packageInfo["value"] == null)
        {
            Console.WriteLine("Failed to get info from package endpoint, returned no packages");
            return GetTaskArray(makeOptions);
        }

        foreach (var package in packageInfo["value"].AsArray())
        {
            if (package["name"] != null && package["versions"] != null)
            {
                var packageName = package["name"].ToString().Substring("Mseng.MS.TF.DistributedTask.Tasks.".Length).ToLower();
                packageMap[packageName] = package["versions"][0]["version"].ToString();
                foreach (var versionInfo in package["versions"].AsArray())
                {
                    if (versionInfo["isLatest"].GetValue<bool>())
                    {
                        packageMap[packageName] = versionInfo["version"].ToString();
                        break;
                    }
                }
            }
        }

        return GetTaskArray(makeOptions).Where(taskName =>
        {
            var taskJsonPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "Tasks", taskName, "task.json");
            if (File.Exists(taskJsonPath))
            {
                var taskJson = JsonNode.Parse(File.ReadAllText(taskJsonPath));
                var lowerCaseName = taskJson["name"].ToString().ToLower();
                if (!int.TryParse(lowerCaseName.Last().ToString(), out _))
                {
                    lowerCaseName += "v" + taskJson["version"]["Major"];
                }

                if (packageMap.ContainsKey(lowerCaseName) || packageMap.ContainsKey(taskName.ToLower()))
                {
                    if (packageMap.ContainsKey(taskName.ToLower()))
                    {
                        lowerCaseName = taskName.ToLower();
                    }

                    var packageVersion = packageMap[lowerCaseName];
                    var localVersion = $"{taskJson["version"]["Major"]}.{taskJson["version"]["Minor"]}.{taskJson["version"]["Patch"]}";

                    return !packageVersion.Equals(localVersion);
                }
                else
                {
                    Console.WriteLine($"{taskName} has not been published before");
                    return true;
                }
            }
            else
            {
                Console.WriteLine($"{taskJsonPath} does not exist");
                return true;
            }
        }).ToList();
    }

    private static List<string> GetTasksDependentOnChangedCommonFiles(List<string> commonFilePaths)
    {
        if (commonFilePaths.Count == 0)
        {
            return new List<string>();
        }

        var changedTasks = new List<string>();
        foreach (var taskName in GetTaskArray(makeOptions))
        {
            var makeJsonPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "Tasks", taskName.ToString(), "make.json");
            if (File.Exists(makeJsonPath))
            {
                var makeJson = JsonNode.Parse(File.ReadAllText(makeJsonPath));
                if (makeJson["common"] != null)
                {
                    foreach (var commonModule in makeJson["common"].AsArray())
                    {
                        if (commonFilePaths.Contains(commonModule["module"].ToString().ToLower()) && !changedTasks.Contains(taskName.ToString()))
                        {
                            changedTasks.Add(taskName.ToString());
                        }
                    }
                }
            }
        }
        return changedTasks;
    }

    private static async Task<(string source, string target)> GetPullRequestBranches(int pullRequestId)
    {
        var response = await client.GetStringAsync($"https://api.github.com/repos/microsoft/azure-pipelines-tasks/pulls/{pullRequestId}");
        var data = JsonNode.Parse(response);
        return (data["head"]["ref"].ToString(), data["base"]["ref"].ToString());
    }

    private static async Task<List<string>> GetTasksToBuildForPR(int? prId, bool forDowngradingCheck)
    {
        string sourceBranch, targetBranch;

        if (prId.HasValue)
        {
            var branches = await GetPullRequestBranches(prId.Value);
            sourceBranch = branches.source;
            targetBranch = branches.target;
        }
        else
        {
            prId = int.Parse(Environment.GetEnvironmentVariable("SYSTEM_PULLREQUEST_PULLREQUESTNUMBER"));
            sourceBranch = Environment.GetEnvironmentVariable("SYSTEM_PULLREQUEST_SOURCEBRANCH");
            targetBranch = Environment.GetEnvironmentVariable("SYSTEM_PULLREQUEST_TARGETBRANCH");
        }

        var commonChanges = new List<string>();
        var commonTestChanges = new List<string>();
        var toBeBuilt = new List<string>();

        if (Environment.OSVersion.Platform != PlatformID.Win32NT)
        {
            sourceBranch = sourceBranch.Replace("#", "\\#");
            targetBranch = targetBranch.Replace("#", "\\#");
        }

        try
        {
            if (sourceBranch.Contains(":"))
            {
                sourceBranch = sourceBranch.Split(':')[1];
            }
            Run($"git fetch origin pull/{prId}/head:{sourceBranch}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Unable to reach github, building all tasks: {ex.Message}");
            return GetTaskArray(makeOptions);
        }

        var baseCommit = Run($"git merge-base {sourceBranch} origin/{targetBranch}");

        var diffExtra = forDowngradingCheck ? (Environment.OSVersion.Platform == PlatformID.Win32NT ? " -- .  :^^**/_buildConfigs/**" : " -- .  :^**/_buildConfigs/**") : "";

        foreach (var filePath in Run($"git --no-pager diff --name-only {baseCommit} {sourceBranch} {diffExtra}").Split('\n'))
        {
            if (filePath.StartsWith("Tasks"))
            {
                var taskPath = filePath.Substring(6);
                if (taskPath.StartsWith("Common"))
                {
                    var commonName = taskPath.Substring(7);
                    if (taskPath.ToLower().Contains("test"))
                    {
                        commonTestChanges.Add($"../common/{commonName.Substring(0, commonName.IndexOf('/')).ToLower()}");
                    }
                    else
                    {
                        commonChanges.Add($"../common/{commonName.Substring(0, commonName.IndexOf('/')).ToLower()}");
                    }
                }
                else
                {
                    var taskName = taskPath.Substring(0, taskPath.IndexOf('/'));
                    if (!toBeBuilt.Contains(taskName))
                    {
                        toBeBuilt.Add(taskName);
                    }
                }
            }
        }

        var changedTasks = GetTasksDependentOnChangedCommonFiles(commonChanges);
        var changedTests = GetTasksDependentOnChangedCommonFiles(commonTestChanges);
        var shouldBeBumped = new List<string>();

        foreach (var task in changedTasks)
        {
            if (!toBeBuilt.Contains(task))
            {
                shouldBeBumped.Add(task);
                toBeBuilt.Add(task);
            }
        }

        var skipBumpingVersionsDueToChangesInCommon = Environment.GetEnvironmentVariable("SKIPBUMPINGVERSIONSDUETOCHANGESINCOMMON").ToLower() == "true";

        if (shouldBeBumped.Count > 0 && !skipBumpingVersionsDueToChangesInCommon)
        {
            throw new Exception($"The following tasks should have their versions bumped due to changes in common: {string.Join(", ", shouldBeBumped)}");
        }

        foreach (var task in changedTests)
        {
            if (!toBeBuilt.Contains(task))
            {
                toBeBuilt.Add(task);
            }
        }

        toBeBuilt = toBeBuilt.Where(taskName => Directory.Exists(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "Tasks", taskName))).ToList();

        return toBeBuilt;
    }

    private static void SetTaskVariables(List<string> tasks, List<string> tasksForDowngradingCheck)
    {
        Console.WriteLine($"tasks: {string.Join(", ", tasks)}");
        Console.WriteLine($"tasksForDowngradingCheck: {string.Join(", ", tasksForDowngradingCheck)}");
        Console.WriteLine($"##vso[task.setVariable variable=task_pattern;isOutput=true;]@({string.Join("|", tasks)})");
        Console.WriteLine($"##vso[task.setVariable variable=task_pattern_fordowngradingcheck]@({string.Join("|", tasksForDowngradingCheck)})");
        Console.WriteLine($"##vso[task.setVariable variable=numTasks]{tasks.Count}");
        Console.WriteLine($"##vso[task.setVariable variable=numTasksForDowngradingCheck]{tasksForDowngradingCheck.Count}");
    }

    private static string Run(string command)
    {
        var process = new System.Diagnostics.Process
        {
            StartInfo = new System.Diagnostics.ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = $"/C {command}",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            }
        };
        process.Start();
        var result = process.StandardOutput.ReadToEnd();
        process.WaitForExit();
        return result;
    }

    public static async Task FilterTasks()
    {
        try
        {
            var buildReason = Environment.GetEnvironmentVariable("BUILD_REASON").ToLower();
            var forceCourtesyPush = Environment.GetEnvironmentVariable("FORCE_COURTESY_PUSH")?.ToLower() == "true";
            var taskNameIsSet = Environment.GetEnvironmentVariable("TASKNAMEISSET")?.ToLower() == "true";
            var deployAllTasks = Environment.GetEnvironmentVariable("DEPLOY_ALL_TASKSVAR")?.ToLower() == "true";

            List<string> tasksFromParameter = null;
            if (taskNameIsSet)
            {
                var taskName = Environment.GetEnvironmentVariable("TASKNAME");
                tasksFromParameter = taskName.Split(',').Select(item => item.Trim()).ToList();
            }

            var ciBuildReasonList = new List<string> { "individualci", "batchedci", "schedule" };

            if (deployAllTasks)
            {
                SetTaskVariables(GetTaskArray(makeOptions), GetTaskArray(makeOptions));
            }
            else if (ciBuildReasonList.Contains(buildReason) || (forceCourtesyPush && !taskNameIsSet))
            {
                var tasks = await GetTasksToBuildForCI();
                SetTaskVariables(tasks, tasks);
            }
            else
            {
                var buildSourceBranch = Environment.GetEnvironmentVariable("BUILD_SOURCEBRANCH");
                var regex = new System.Text.RegularExpressions.Regex(@"^refs\/pull\/(\d+)\/merge$");
                var prIdMatch = regex.Match(buildSourceBranch);

                if (buildReason == "pullrequest")
                {
                    var tasks = await GetTasksToBuildForPR(null, false);
                    var tasksForDowngradingCheck = await GetTasksToBuildForPR(null, true);
                    SetTaskVariables(tasks, tasksForDowngradingCheck);
                }
                else if (buildReason == "manual" && prIdMatch.Success)
                {
                    var prId = int.Parse(prIdMatch.Groups[1].Value);
                    var tasks = await GetTasksToBuildForPR(prId, false);
                    var tasksForDowngradingCheck = await GetTasksToBuildForPR(prId, true);
                    SetTaskVariables(tasks, tasksForDowngradingCheck);
                }
                else if (buildReason == "manual" && taskNameIsSet)
                {
                    var unknownTasks = tasksFromParameter.Where(task => !GetTaskArray(makeOptions).Contains(task)).ToList();
                    if (unknownTasks.Count > 0)
                    {
                        throw new Exception($"Can't find \"{string.Join(", ", unknownTasks)}\" task(s) in the make-options.json file.");
                    }
                    SetTaskVariables(tasksFromParameter, tasksFromParameter);
                }
                else
                {
                    SetTaskVariables(GetTaskArray(makeOptions), GetTaskArray(makeOptions));
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"##vso[task.logissue type=error]{ex.Message}");
            Console.WriteLine("##vso[task.complete result=Failed;]");
        }
    }

    private static List<string> GetTaskArray(JsonNode? makeOptions)
    {
        return makeOptions["tasks"].AsArray().Select(task => task.ToString()).ToList();
    }

    public static async Task LocalMain(string[] args)
    {
        await FilterTasks();
    }
}
