using System.Text.RegularExpressions;

namespace BuildConfigGen
{
    internal static class GitUtil
    {
        static (string? gitRoot, IEnumerable<string>? cache) NonIgnoredFileListCache;

        public static void GetUntrackedFiles(string taskTarget, out IEnumerable<string> toAdd, out IEnumerable<string> toRemove)
        {
            if (!Directory.Exists(taskTarget))
            {
                toAdd = new string[0];
                toRemove = new string[0];
                return;
            }

            // get directory prefix
            int exitCode3;
            string[] revParseOut;
            string revParsePrefix;
            if ((exitCode3 = ProcessUtil.RunCommandWithExitCode("git", "rev-parse --show-prefix", taskTarget, out revParseOut)) == 0)
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
            if ((exitCode2 = ProcessUtil.RunCommandWithExitCode("git", gitaddDryRun, taskTarget, out untrackedOutput)) == 0)
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
        internal static string GetGitRootPath(string currentDir)
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

        internal static IEnumerable<string> GetNonIgnoredFileListFromPath(string gitRoot, string taskTarget)
        {
            // the new version gets the non-ignored files frmo the root, caches and filters based on taskTarget.  It's 6x faster
            return GetNonIgnoredFileListFromPathInnerIncludingFromGeneratedLocalFilteredByTaskTarget(gitRoot, taskTarget);
        }

        private static IEnumerable<string> GetNonIgnoredFileListFromPathInnerIncludingFromGeneratedLocalFilteredByTaskTarget(string gitRoot, string taskTarget)
        {
            if (!taskTarget.StartsWith(gitRoot, StringComparison.OrdinalIgnoreCase))
            {
                throw new Exception($"expected taskTarget={taskTarget} to start with gitRoot={gitRoot}");
            }

            string taskTargetSubpath = taskTarget.Substring(gitRoot.Length);

            if(NonIgnoredFileListCache.gitRoot is not null)
            {
                NonIgnoredFileListCache.gitRoot = gitRoot;

                if(gitRoot!= NonIgnoredFileListCache.gitRoot)
                {
                    throw new Exception($"BUG: gitroot={gitRoot} expected to match {NonIgnoredFileListCache.gitRoot}=NonIgnoredFileListCache.gitRoot");
                }
            }

            if (NonIgnoredFileListCache.cache is null)
            {
                NonIgnoredFileListCache.cache = GetNonIgnoredFileListFromPathInnerIncludingFromGeneratedLocal(gitRoot);
            }

            return NonIgnoredFileListCache.cache.Where(x => x.StartsWith(taskTargetSubpath + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)).Select(x =>
            {
                var y = x.Substring(taskTargetSubpath.Length);

                if (y.StartsWith("/") || y.StartsWith(@"\"))
                {
                    return y.Substring(1);
                }
                else
                {
                    throw new Exception($"BUG: expected y={y} to start with / or \\ ");
                }
            });
        }

        private static IEnumerable<string> GetNonIgnoredFileListFromPathInnerIncludingFromGeneratedLocal(string gitRoot)
        {
            string gitIgnorePathBak = Path.Combine(gitRoot, ".gitignore.bak");
            string gitIgnore = Path.Combine(gitRoot, ".gitignore");

            string? gitIgnoreContent = File.ReadAllText(gitIgnore);
            const string genertedLocalPath = "_generated_local/";

            if (!gitIgnoreContent.Contains(genertedLocalPath))
            {
                throw new Exception("Expected " + genertedLocalPath + " in " + gitIgnore);
            }

            gitIgnoreContent = gitIgnoreContent.Replace(genertedLocalPath, "");

            File.Copy(gitIgnore, gitIgnorePathBak, true);

            try
            {
                File.WriteAllText(gitIgnore, gitIgnoreContent);

                return GetNonIgnoredFileListFromPathInner(gitRoot);
            }
            finally
            {
                if (File.Exists(gitIgnorePathBak))
                {
                    File.Move(gitIgnorePathBak, gitIgnore, true);
                }
            }
        }

        private static IEnumerable<string> GetNonIgnoredFileListFromPathInner(string taskTarget)
        {
            if (!Directory.Exists(taskTarget))
            {
                throw new Exception($"{nameof(taskTarget)}=={taskTarget} doesn't exist");
            }

            var output = GitLsFiles(taskTarget).Select(FixupPath);
            IEnumerable<string> untrackedOuput2;
            IEnumerable<string> untrackedToRemove;
            GitUtil.GetUntrackedFiles(taskTarget, out untrackedOuput2, out untrackedToRemove);
            var paths = output.Union(untrackedOuput2);
            paths = paths.Except(untrackedToRemove);

            return paths;
        }

        private static IEnumerable<string> GitLsFiles(string taskTarget)
        {
            if (!Directory.Exists(taskTarget))
            {
                throw new Exception($"{nameof(taskTarget)}=={taskTarget} doesn't exist");
                //return new string[0];
            }

            int exitCode;
            string[] output;
            if ((exitCode = ProcessUtil.RunCommandWithExitCode("git", "ls-files", taskTarget, out output)) == 0)
            {
            }
            else
            {
                throw new Exception("non-zero exit code");
            }

            return output;
        }

        private static string RunGitCommandScalar(string currentDir, string args)
        {
            if (!Directory.Exists(currentDir))
            {
                throw new Exception($"{nameof(currentDir)}=={currentDir} doesn't exist");
                //return new string[0];
            }

            string[] output;
            int exitCode;
            if (0 != (exitCode = ProcessUtil.RunCommandWithExitCode("git", args, currentDir, out output)))
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


        public static string FixupPath(string s)
        {
            if (Path.DirectorySeparatorChar == '\\')
            {
                return s.Replace("/", "\\");
            }

            return s;
        }
    }
}
