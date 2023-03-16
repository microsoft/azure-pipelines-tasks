using System;
using System.CommandLine;
using System.Diagnostics;
using System.Globalization;
using System.Net.Http.Headers;
using System.Runtime.Serialization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

class Program
{

    /// <param name="task">The task to generate build configs for</param>
    static void Main(string task = "")
    {
        if(string.IsNullOrEmpty(task))
        {
            throw new Exception("task expected!");
        }

        string currentDir = Environment.CurrentDirectory;

        string gitRootPath = GetGitRootPath(currentDir);


        //string task = "DownloadBuildArtifactsV0";

        string taskTarget = Path.Combine(gitRootPath, "Tasks", task);
        if(!Directory.Exists(taskTarget))
        {
            throw new Exception($"expected {taskTarget} to exist!");
        }

        string taskOutput = Path.Combine(gitRootPath, "_generated", task);
        string taskOutputNode16 = Path.Combine(gitRootPath, "_generated", @$"{task}_Node16");
        
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

        CopyConfigs(taskTarget, taskOutput);
        CopyConfigs(taskTarget, taskOutputNode16);

        UpdateVersions(gitRootPath, task, taskTarget, taskOutput, taskOutputNode16);
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
    private static string GetGitRootPath(string currentDir)
    {
        const string args = "rev-parse --git-dir";
        string path = RunGitCommandScalar(currentDir, args);

        path = FixupPath(path);

        const string gitDir = ".git";
        if (path.EndsWith(gitDir))
        {
            path = path.Substring(0, path.Length - gitDir.Length);

            if (path == "")
            {
                return currentDir;
            }

            return path;
        }
        else
        {
            throw new Exception($"expected git {args} to return  ");
        }
    }

    private static string RunGitCommandScalar(string currentDir, string args)
    {
        string[] output;
        int exitCode;
        if (0 != (exitCode = RunCommandWithExitCode("git", args, currentDir, out output)))
        {
            throw new Exception($"non-zero from git {exitCode}");
        }

        if (output.Length > 0)
        {
            return output[0];
        }
        else
        {
            throw new Exception($"no output from {args}");
        }
    }

    private static void CopyConfigs(string taskTarget, string taskOutput)
    {
        var paths = GetNonIgnoredFileListFromPath(taskTarget);
        var targetPaths = new HashSet<string>(GetNonIgnoredFileListFromPath(taskOutput));

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

    private static void UpdateVersions(string gitRootPath, string task, string taskTarget, string taskOutput, string taskOutputNode16)
    {
        string versionMapFile = Path.Combine(gitRootPath,"_generated", @$"{task}.versionmap.txt");
        Dictionary<string, TaskVersion> versionMap;
        TaskVersion? maxVersion;
        ReadVersionMap(versionMapFile, out versionMap, out maxVersion);


        string inputTaskPath = Path.Combine(taskTarget, "task.json");
        string outputTaskPath = Path.Combine(taskOutput, "task.json");
        string outputTaskLocPath = Path.Combine(taskOutput, "task.loc.json");
        string outputNode16PackagePath = Path.Combine(taskOutputNode16, "package.json");
        string outputNode16TaskPath = Path.Combine(taskOutputNode16, "task.json");
        string outputNode16TTaskLocPath = Path.Combine(taskOutputNode16, "task.loc.json");


        JsonNode inputTaskNode = JsonNode.Parse(File.ReadAllText(inputTaskPath))!;
        JsonNode outputTaskNode = JsonNode.Parse(File.ReadAllText(outputTaskPath))!;
        JsonNode outputTaskLocNode = JsonNode.Parse(File.ReadAllText(outputTaskLocPath))!;
        JsonNode outputNod16PackagePath = JsonNode.Parse(File.ReadAllText(outputNode16PackagePath))!;
        JsonNode outputNode16TaskNode = JsonNode.Parse(File.ReadAllText(outputNode16TaskPath))!;
        JsonNode outputNode16TaskLocNode = JsonNode.Parse(File.ReadAllText(outputNode16TTaskLocPath))!;

        Int32 major;
        Int32 minor;
        Int32 patch;

        // Need to parse it to a int because the version can be a string or an int (example: AzureStaticWebAppV0)
        Int32.TryParse(inputTaskNode["version"]!["Major"]!.ToString(), out major);
        Int32.TryParse(inputTaskNode["version"]!["Minor"]!.ToString(), out minor);
        Int32.TryParse(inputTaskNode["version"]!["Patch"]!.ToString(), out patch);

        TaskVersion inputVersion = new(major, minor, patch);

        if (!(maxVersion is null) && inputVersion < maxVersion)
        {
            throw new Exception($"version specified in task {taskTarget} must not be less than maxversion {maxVersion} specified in {versionMapFile}");
        }

        TaskVersion node16PatchVersion;
        TaskVersion defaultPatchVersion;

        TaskVersion? defaultVersion = null;

        if (versionMap.ContainsKey("Default"))
        {
            defaultVersion = versionMap["Default"];
        }

        if (!(defaultVersion is null) && inputVersion == defaultVersion)
        {
            node16PatchVersion = inputVersion.CloneWithPatch(versionMap["Node16"].Patch);
            defaultPatchVersion = inputVersion.CloneWithPatch(defaultVersion.Patch);
        }
        else
        {
            node16PatchVersion = inputVersion.CloneWithPatch(patch);

            // important: for backwards compatibilty, the greatest patch number must be the default
            defaultPatchVersion = inputVersion.CloneWithPatch(node16PatchVersion.Patch + 1);
        }

        outputNod16PackagePath["dependencies"]!["@types/node"] = "^16.11.39";

        inputTaskNode["version"]!["Patch"] = defaultPatchVersion.Patch;
        outputTaskNode["version"]!["Patch"] = defaultPatchVersion.Patch;
        outputTaskLocNode["version"]!["Patch"] = defaultPatchVersion.Patch;
        outputNode16TaskNode["version"]!["Patch"] = node16PatchVersion.Patch;
        outputNode16TaskLocNode["version"]!["Patch"] = node16PatchVersion.Patch;


        outputTaskNode.AsObject()?.Remove("_buildConfigMapping");

        outputTaskNode.AsObject().Add("_buildConfigMapping", new JsonObject
        {
            ["Node16"] = node16PatchVersion.ToString(),
            ["Default"] = defaultPatchVersion.ToString()
        });

        outputNode16TaskNode.AsObject()?.Remove("_buildConfigMapping");

        outputNode16TaskNode.AsObject().Add("_buildConfigMapping", new JsonObject
        {
            ["Node16"] = node16PatchVersion.ToString(),
            ["Default"] = defaultPatchVersion.ToString()
        });

        using (var fs = File.Open(versionMapFile, FileMode.Create))
        {
            using (var sw = new StreamWriter(fs))
            {
                sw.WriteLine(string.Concat("Default|", defaultPatchVersion));
                sw.WriteLine(string.Concat("Node16|", node16PatchVersion));
            }
        }

        addNode16handler(outputNode16TaskNode);
        addNode16handler(outputNode16TaskLocNode);

        JsonSerializerOptions jso = new System.Text.Json.JsonSerializerOptions { WriteIndented = true };
        File.WriteAllText(inputTaskPath, inputTaskNode.ToJsonString(jso));
        File.WriteAllText(outputTaskPath, outputTaskNode.ToJsonString(jso));
        File.WriteAllText(outputTaskLocPath, outputTaskLocNode.ToJsonString(jso));
        File.WriteAllText(outputNode16PackagePath, outputNod16PackagePath.ToJsonString(jso));
        File.WriteAllText(outputNode16TaskPath, outputNode16TaskNode.ToJsonString(jso));
        File.WriteAllText(outputNode16TTaskLocPath, outputNode16TaskLocNode.ToJsonString(jso));
    }

    private static string getExecutionPath(JsonNode taskNode, string execution)
    {
        var handlers = taskNode[execution]?.AsObject();
        if (handlers != null) {
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

    private static void addNode16handler(JsonNode taskNode)
    {
        taskNode["prejobexecution"]?.AsObject().Add("Node16", new JsonObject
        {
            ["target"] = getExecutionPath(taskNode, "prejobexecution"),
            ["argumentFormat"] = ""
        });

        taskNode["execution"]?.AsObject().Add("Node16", new JsonObject
        {
            ["target"] = getExecutionPath(taskNode, "execution"),
            ["argumentFormat"] = ""
        });

        taskNode["postjobexecution"]?.AsObject().Add("Node16", new JsonObject
        {
            ["target"] = getExecutionPath(taskNode, "postjobexecution"),
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

    public record Version(int Major, int Minor, int Patch);

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

    private static IEnumerable<string> GetNonIgnoredFileListFromPath(string taskTarget)
    {
        var output = GitLsFiles(taskTarget).Select(FixupPath);
        IEnumerable<string> untrackedOuput2;
        IEnumerable<string> untrackedToRemove;
        GetUntrackedFiles(taskTarget, out untrackedOuput2, out untrackedToRemove);
        var paths = output.Union(untrackedOuput2);
        paths = paths.Except(untrackedToRemove);

        return paths;
    }

    private static string FixupPath(string s)
    {
        if (Path.DirectorySeparatorChar == '\\')
        {
            return s.Replace("/", "\\");
        }

        return s;
    }

    private static void GetUntrackedFiles(string taskTarget, out IEnumerable<string> toAdd, out IEnumerable<string> toRemove)
    {
        if (!Directory.Exists(taskTarget))
        {
            toAdd =  new string[0];
            toRemove = new string[0];
            return;
        }

        // get directory prefix
        int exitCode3;
        string[] revParseOut;
        string revParsePrefix;
        if ((exitCode3 = RunCommandWithExitCode("git", "rev-parse --show-prefix", taskTarget, out revParseOut)) == 0)
        {
            if (revParseOut.Length < 1)
            {
                throw new Exception("revParseOut.Length<1");
            }

            revParsePrefix = revParseOut[0];
        }
        else
        {
            throw new Exception("non-zero exit code");
        }

        string[] untrackedOutput;
        int exitCode2;
        const string gitaddDryRun = "add . --dry-run";
        if ((exitCode2 = RunCommandWithExitCode("git", gitaddDryRun, taskTarget, out untrackedOutput)) == 0)
        {

        }
        else
        {
            throw new Exception("non-zero exit code");
        }
        List<string> untrackedOuput2 = new();
        List<string> untrackedOuputRemove = new();
        const string fileNameGroup = "fileNameGroup";
        const string action = "action";
        const string addPattern = $@"^(?<{action}>add|remove) '(?<{fileNameGroup}>.*)'$";
        Regex re = new Regex(addPattern, RegexOptions.Singleline);
        foreach (var o in untrackedOutput)
        {
            Match? m = null;
            if (null != (m = re.Match(o)))
            {
                if (m.Success)
                {
                    List<string> target;

                    if (m.Groups[action].Value == "remove")
                    {
                        target = untrackedOuputRemove;
                    }
                    else
                    {
                        if (m.Groups[action].Value != "add")
                        {
                            throw new Exception($"expected add or remove in {o}");
                        }
                        target = untrackedOuput2;
                    }

                    string path = m.Groups[fileNameGroup].Value;
                    if (!path.StartsWith(revParsePrefix))
                    {
                        throw new Exception($"expected {path} to start with ${revParsePrefix}");
                    }

                    path = path.Remove(0, revParsePrefix.Length);

                    target.Add(FixupPath(path));
                }
                else
                {
                    throw new Exception($"'{o}' did not match expected output");
                }
            }
            else
            {
                throw new Exception($"unexpected line from output didn't match regex. {nameof(o)}={o}  {nameof(gitaddDryRun)}={gitaddDryRun} {nameof(addPattern)}={addPattern}");
            }
        }

        toAdd = untrackedOuput2;
        toRemove = untrackedOuputRemove;
    }

    private static IEnumerable<string> GitLsFiles(string taskTarget)
    {
        if (!Directory.Exists(taskTarget))
        {
            return new string[0];
        }

        int exitCode;
        string[] output;
        if ((exitCode = RunCommandWithExitCode("git", "ls-files", taskTarget, out output)) == 0)
        {
        }
        else
        {
            throw new Exception("non-zero exit code");
        }

        return output;
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

    static int RunCommandWithExitCode(string program, string args, string workingDir, out string[] output)
    {
        using (Process p = new Process())
        {
            p.StartInfo.FileName = program;
            p.StartInfo.Arguments = args;
            p.StartInfo.UseShellExecute = false;
            p.StartInfo.WorkingDirectory = workingDir;
            p.StartInfo.RedirectStandardOutput = true;
            p.Start();

            List<string> sb = new();
            string? line;
            while ((line = p.StandardOutput.ReadLine()) != null)
            {
                sb.Add(line);
            }

            output = sb.ToArray();

            p.WaitForExit();
            return p.ExitCode;
        }
    }


    public class TaskVersion : IComparable<TaskVersion>, IEquatable<TaskVersion>
    {
        public TaskVersion(String version)
        {
            Int32 major, minor, patch;
            String? semanticVersion;

            VersionParser.ParseVersion(version, out major, out minor, out patch, out semanticVersion);
            Major = major;
            Minor = minor;
            Patch = patch;

            if (semanticVersion != null)
            {
                if (semanticVersion.Equals("test", StringComparison.OrdinalIgnoreCase))
                {
                    IsTest = true;
                }
                else
                {
                    throw new ArgumentException("semVer");
                }
            }
        }

        private TaskVersion(TaskVersion taskVersionToClone)
        {
            this.IsTest = taskVersionToClone.IsTest;
            this.Major = taskVersionToClone.Major;
            this.Minor = taskVersionToClone.Minor;
            this.Patch = taskVersionToClone.Patch;
        }

        public TaskVersion(int major, int minor, int overidePatch)
        {
            Major = major;
            Minor = minor;
            Patch = overidePatch;
        }

        public Int32 Major
        {
            get;
            set;
        }

        public Int32 Minor
        {
            get;
            set;
        }

        public Int32 Patch
        {
            get;
            set;
        }

        public Boolean IsTest
        {
            get;
            set;
        }

        public TaskVersion Clone()
        {
            return new TaskVersion(this);
        }

        public TaskVersion CloneWithPatch(int overridePatch)
        {
            return new TaskVersion(Major, Minor, overridePatch);
        }

        public static implicit operator String(TaskVersion version)
        {
            return version.ToString();
        }

        public override String ToString()
        {
            String suffix = String.Empty;
            if (IsTest)
            {
                suffix = "-test";
            }

            return String.Format(CultureInfo.InvariantCulture, "{0}.{1}.{2}{3}", Major, Minor, Patch, suffix);
        }

        public override int GetHashCode()
        {
            return this.ToString().GetHashCode();
        }

        public Int32 CompareTo(TaskVersion? other)
        {
            if (other is null)
            {
                throw new ArgumentNullException("other");
            }

            Int32 rc = Major.CompareTo(other.Major);
            if (rc == 0)
            {
                rc = Minor.CompareTo(other.Minor);
                if (rc == 0)
                {
                    rc = Patch.CompareTo(other.Patch);
                    if (rc == 0 && this.IsTest != other.IsTest)
                    {
                        rc = this.IsTest ? -1 : 1;
                    }
                }
            }

            return rc;
        }

        public Boolean Equals(TaskVersion? other)
        {
            if (other is null)
            {
                return false;
            }

            return this.CompareTo(other) == 0;
        }

        public override bool Equals(object? obj)
        {
            return Equals(obj as TaskVersion);
        }

        public static Boolean operator ==(TaskVersion v1, TaskVersion v2)
        {
            if (v1 is null)
            {
                return v2 is null;
            }

            return v1.Equals(v2);
        }

        public static Boolean operator !=(TaskVersion v1, TaskVersion v2)
        {
            if (v1 is null)
            {
                return !(v2 is null);
            }

            return !v1.Equals(v2);
        }

        public static Boolean operator <(TaskVersion v1, TaskVersion v2)
        {
            ArgumentUtility.CheckForNull(v1, nameof(v1));
            ArgumentUtility.CheckForNull(v2, nameof(v2));
            return v1.CompareTo(v2) < 0;
        }

        public static Boolean operator >(TaskVersion v1, TaskVersion v2)
        {
            ArgumentUtility.CheckForNull(v1, nameof(v1));
            ArgumentUtility.CheckForNull(v2, nameof(v2));
            return v1.CompareTo(v2) > 0;
        }

        public static Boolean operator <=(TaskVersion v1, TaskVersion v2)
        {
            ArgumentUtility.CheckForNull(v1, nameof(v1));
            ArgumentUtility.CheckForNull(v2, nameof(v2));
            return v1.CompareTo(v2) <= 0;
        }

        public static Boolean operator >=(TaskVersion v1, TaskVersion v2)
        {
            ArgumentUtility.CheckForNull(v1, nameof(v1));
            ArgumentUtility.CheckForNull(v2, nameof(v2));
            return v1.CompareTo(v2) >= 0;
        }
    }

    public static class VersionParser
    {
        public static void ParseVersion(
            String version,
            out Int32 major,
            out Int32 minor,
            out Int32 patch,
            out String? semanticVersion)
        {
            ArgumentUtility.CheckStringForNullOrEmpty(version, "version");

            String[] segments = version.Split(new char[] { '.', '-' }, StringSplitOptions.None);
            if (segments.Length < 3 || segments.Length > 4)
            {
                throw new ArgumentException("wrong number of segments");
            }

            if (!Int32.TryParse(segments[0], out major))
            {
                throw new ArgumentException("major");
            }

            if (!Int32.TryParse(segments[1], out minor))
            {
                throw new ArgumentException("minor");
            }

            if (!Int32.TryParse(segments[2], out patch))
            {
                throw new ArgumentException("patch");
            }

            semanticVersion = null;
            if (segments.Length == 4)
            {
                semanticVersion = segments[3];
            }
        }
    }

    class ArgumentUtility
    {
        internal static void CheckForNull(TaskVersion? c, string v)
        {
            if (c is null)
            {
                throw new ArgumentNullException(v);
            }
        }

        internal static void CheckStringForNullOrEmpty(string c, string v)
        {
            if (string.IsNullOrEmpty(v))
            {
                throw new ArgumentNullException(v);

            }
        }
    }
}

