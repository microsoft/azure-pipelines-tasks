using System.ComponentModel.Design;
using System.Diagnostics;
using System.Security.AccessControl;

namespace BuildConfigGen
{
    internal class EnsureUpdateModeVerifier
    {
        // the goal of verification is to ensure the generation is up-to-date
        // if any changes would be made to output, verification should fail
        // check the contents of VerifyErrors for verification errors

        private readonly bool verifyOnly;
        private List<string> VerifyErrors = new List<string>();
        internal Dictionary<string, string> CopiedFilesToCheck = new Dictionary<string, string>();
        internal Dictionary<string, string> RedirectedToTempl = new Dictionary<string, string>();

        public EnsureUpdateModeVerifier(bool verifyOnly)
        {
            this.verifyOnly = verifyOnly;
        }

        public IEnumerable<string> GetVerifyErrors(bool skipContentCheck)
        {
            foreach (var r in VerifyErrors)
            {
                yield return r;
            }

            if (!skipContentCheck)
            {

                foreach (var r in CopiedFilesToCheck)
                {
                    string? sourceFile;
                    string procesed = "";

                    if (RedirectedToTempl.TryGetValue(r.Key, out sourceFile))
                    {
                        procesed = "(processed) ";
                    }
                    else
                    {
                        sourceFile = r.Value;
                    }

                    if (Helpers.FilesEqual(sourceFile, r.Key))
                    {
                        // if overwrite and content match, everything is good!  Verification passed.
                    }
                    else
                    {
                        yield return $"Content doesn't match {r.Value} {procesed}to {r.Key} (overwrite=true).  Dest file doesn't match {procesed}source.";
                    }
                }
            }
        }

        public void CleanupTempFiles()
        {
            int count = 0;
            foreach (var f in RedirectedToTempl.Values)
            {
                count++;
                if (File.Exists(f))
                {
                    File.Delete(f);
                }
            }

            if (count > 0 && !verifyOnly)
            {
                throw new Exception("Expected RedirectedToTemp to be empty when !verifyOnly");
            }
        }

        internal void Copy(string sourceFileName, string destFileName, bool overwrite)
        {
            if (verifyOnly)
            {
                if (File.Exists(destFileName))
                {
                    if (overwrite)
                    {
                        // we might check the content here, but we defer it in cause the content gets updated in WriteAllText
                        string normalizedDestFileName = NormalizeFile(destFileName);
                        string normalizedSourceFileName = NormalizeFile(sourceFileName);
                        if (!CopiedFilesToCheck.TryAdd(normalizedDestFileName, normalizedSourceFileName))
                        {
                            CopiedFilesToCheck[normalizedDestFileName] = normalizedSourceFileName;
                        }
                    }
                    else
                    {
                        // similar exception we'd get if we invoked File.Copy with existing file and overwrite=false
                        throw new Exception($"destFileName={destFileName} exists and overwrite is false");
                    }
                }
                else
                {
                    VerifyErrors.Add($"Copy {sourceFileName} to {destFileName} (overwrite={overwrite}).  Dest file doesn't exist.");
                }
            }
            else
            {
                File.Copy(sourceFileName, destFileName, overwrite);
            }
        }

        internal void Move(string sourceFileName, string destFileName)
        {
            if (verifyOnly)
            {
                // verification won't pass if we encounter a move

                if (File.Exists(destFileName))
                {
                    // similar exception we'd get if we invoked File.Move with existing file
                    throw new Exception($"destFileName={destFileName} exists");
                }
                else
                {
                    VerifyErrors.Add($"Need to move {sourceFileName} to {destFileName}.  Dest file doesn't exist.");
                }
            }
            else
            {
                File.Move(sourceFileName, destFileName);
            }
        }

        internal void WriteAllText(string path, string contents, bool suppressValidationErrorIfTargetPathDoesntExist)
        {
            if (verifyOnly)
            {
                if (File.Exists(path))
                {
                    string? tempFilePath;

                    if (!RedirectedToTempl.TryGetValue(path, out tempFilePath))
                    {
                        tempFilePath = Path.Combine(Path.GetTempPath(), Path.GetRandomFileName());
                        RedirectedToTempl.Add(path, tempFilePath);
                    }

                    //Console.WriteLine($"writing to tempFilePath={tempFilePath}");
                    File.WriteAllText(tempFilePath, contents);
                }
                else
                {
                    string item = $"Need to write content to {path} content.Length={contents.Length}, destination does not exist";

                    if (suppressValidationErrorIfTargetPathDoesntExist)
                    {
                        Console.WriteLine("Skipping adding validation warning due to suppressValidationErrorIfTargetPathDoesntExist: " + item);
                    }
                    else
                    {
                        VerifyErrors.Add(item);
                    }
                }
            }
            else
            {
                File.WriteAllText(path, contents);
            }
        }

        private string NormalizeFile(string file)
        {
            FileInfo fi = new FileInfo(file);
            return fi.FullName;
        }

        internal void DirectoryCreateDirectory(string path, bool suppressValidationErrorIfTargetPathDoesntExist)
        {
            if (verifyOnly)
            {
                if (!Directory.Exists(path))
                {
                    string item = $"Need to create directory {path}";
                    if (suppressValidationErrorIfTargetPathDoesntExist)
                    {
                        Console.WriteLine("Skipping adding VerifyError due to suppressValidationErrorIfTargetPathDoesntExist=true:" + item);
                    }
                    else
                    {
                        VerifyErrors.Add(item);
                    }
                }
            }
            else
            {
                Directory.CreateDirectory(path);
            }
        }

        internal string FileReadAllText(string filePath)
        {
            if (verifyOnly)
            {
                string targetFile = ResolveFile(filePath);

                return File.ReadAllText(targetFile);
            }
            else
            {
                return File.ReadAllText(filePath);
            }
        }

        internal string [] FileReadAllLines(string filePath)
        {
            if (verifyOnly)
            {
                string targetFile = ResolveFile(filePath);

                return File.ReadAllLines(targetFile);
            }
            else
            {
                return File.ReadAllLines(filePath);
            }
        }

        internal bool FilesEqual(string sourcePath, string targetPath)
        {
            var resolvedTargetPath = ResolveFile(targetPath);

            return Helpers.FilesEqual(sourcePath, resolvedTargetPath);
        }

        private string ResolveFile(string filePath)
        {
            if(!verifyOnly)
            {
                return filePath;
            }

            filePath = NormalizeFile(filePath);

            string? sourceFile = null, tempFile = null;
            if (CopiedFilesToCheck.TryGetValue(filePath, out sourceFile))
            {
                if (RedirectedToTempl.TryGetValue(sourceFile, out tempFile))
                {
                    // do nothing
                }
            }

            string targetFile = tempFile ?? sourceFile ?? filePath;
            return targetFile;
        }
    }
}