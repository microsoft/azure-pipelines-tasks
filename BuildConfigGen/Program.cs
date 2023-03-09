using System;
using System.CommandLine;
using System.Diagnostics;
using System.Globalization;
using System.Net.Http.Headers;
using System.Runtime.Serialization;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

class Program
{

    static void Main()
    {
        const string versionMapFile = @"C:\repos\azure-pipelines-tasks\_Generated\DownloadBuildArtifactsV0.versionmap.txt";
        Dictionary<string, TaskVersion> versionMap = new();
        TaskVersion? maxVersion = null;

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

        string taskTarget = @"C:\repos\azure-pipelines-tasks\Tasks\DownloadBuildArtifactsV0";
        string taskOutput = @"C:\repos\azure-pipelines-tasks\_generated\DownloadBuildArtifactsV0";
        string taskOutputNode16 = @"C:\repos\azure-pipelines-tasks\_generated\DownloadBuildArtifactsV0_Node16";

        string inputTaskPath = Path.Combine(taskTarget, "task.json");
        string outputTaskPath = Path.Combine(taskOutput, "task.json");
        string outputTaskLocPath = Path.Combine(taskOutput, "task.loc.json");
        string outputPackagePath = Path.Combine(taskOutput, "package.json");
        string outputNode16TaskPath = Path.Combine(taskOutputNode16, "task.json");


        var taskJson = File.ReadAllText(outputTaskPath);

        JsonNode inputTaskNode = JsonNode.Parse(File.ReadAllText(inputTaskPath))!;
        JsonNode outputTaskNode = JsonNode.Parse(File.ReadAllText(outputTaskPath))!;
        JsonNode outputTaskLocNode = JsonNode.Parse(File.ReadAllText(outputTaskLocPath))!;
        JsonNode outputPackageNode = JsonNode.Parse(File.ReadAllText(outputPackagePath))!;
        JsonNode outputNode16TaskNode = JsonNode.Parse(File.ReadAllText(outputNode16TaskPath))!;

        var major = inputTaskNode["version"]!["Major"]!.GetValue<int>();
        var minor = inputTaskNode["version"]!["Minor"]!.GetValue<int>();
        var patch = inputTaskNode["version"]!["Patch"]!.GetValue<int>();

        TaskVersion inputVersion = new TaskVersion($"{major}.{minor}.{patch}");

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

        outputNode16TaskNode["version"]!["Patch"] = node16PatchVersion.Patch;
        outputTaskNode["version"]!["Patch"] = defaultPatchVersion.Patch;
        outputPackageNode["dependencies"]!["@types/node"] = "^16.11.39";


        inputTaskNode["version"]!["Patch"] = defaultPatchVersion.Patch;
        outputTaskNode["version"]!["Patch"] = defaultPatchVersion.Patch;
        outputNode16TaskNode["version"]!["Patch"] = node16PatchVersion.Patch;


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

        //taskNode.Dump();
        //packageNode.Dump();

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
        var untrackedOuput2 = GetUntrackedFiles(taskTarget).Select(FixupPath);
        var paths = output.Union(untrackedOuput2);
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

    private static IEnumerable<string> GetUntrackedFiles(string taskTarget)
    {
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
        const string gitaddDryRun = "add * --dry-run";
        if ((exitCode2 = RunCommandWithExitCode("git", gitaddDryRun, taskTarget, out untrackedOutput)) == 0)
        {

        }
        else
        {
            throw new Exception("non-zero exit code");
        }
        List<string> untrackedOuput2 = new();
        const string fileNameGroup = "fileNameGroup";

        const string addPattern = $@"^add '(?<{fileNameGroup}>.*)'$";
        Regex re = new Regex(addPattern, RegexOptions.Singleline);
        foreach (var o in untrackedOutput)
        {
            Match? m = null;
            if (null != (m = re.Match(o)))
            {
                string path = m.Groups[fileNameGroup].Value;
                if (!path.StartsWith(revParsePrefix))
                {
                    throw new Exception($"expected {path} to start with ${revParsePrefix}");
                }

                path = path.Remove(0, revParsePrefix.Length);

                untrackedOuput2.Add(path);
            }
            else
            {
                throw new Exception($"unexpected line from output didn't match regex. {nameof(o)}={o}  {nameof(gitaddDryRun)}={gitaddDryRun} {nameof(addPattern)}={addPattern}");
            }
        }

        return untrackedOuput2;
    }

    private static IEnumerable<string> GitLsFiles(string taskTarget)
    {
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

