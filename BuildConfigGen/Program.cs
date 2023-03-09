using System;
using System.CommandLine;
using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

class Program
{
    static void Main()
    {
        string taskTarget = @"C:\repos\azure-pipelines-tasks\Tasks\DownloadBuildArtifactsV0";
        string taskOutput = @"C:\repos\azure-pipelines-tasks\_generated\DownloadBuildArtifactsV0";
        string taskOutputNode16 = @"C:\repos\azure-pipelines-tasks\_generated\DownloadBuildArtifactsV0_Node16";

        string taskPath = Path.Combine(taskTarget, "task.json");
        string taskLocPath = Path.Combine(taskTarget, "task.loc.json");
        string packagePath = Path.Combine(taskTarget, "package.json");

        var taskJson = File.ReadAllText(taskPath);

        JsonNode taskNode = JsonNode.Parse(File.ReadAllText(taskPath))!;
        JsonNode taskLocNode = JsonNode.Parse(File.ReadAllText(taskLocPath))!;
        JsonNode packageNode = JsonNode.Parse(File.ReadAllText(packagePath))!;

        var n = GetNodePath(taskNode, "version", "Patch");
        n = "2";

        n = GetNodePath(packageNode, "dependencies", "@types/node");
        n = "^16.11.39";

        taskNode.AsObject()?.Remove("_buildConfigMapping");

        taskNode.AsObject().Add("_buildConfigMapping", new JsonObject
        {
            ["Default"] = "0.219.1",
            ["Node16"] = "0.219.2"
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
            if(File.Exists(destFileName))
            {
                throw new Exception($"{destFileName} already exists; please clean up");
            }
            File.Move(targetPath, destFileName);

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
                if(!path.StartsWith(revParsePrefix))
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
}