namespace BuildConfigGen
{
    internal static class Helpers
    {

        internal static bool FilesEqual(string sourcePath, string targetPath)
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

            bool eof = false;
            const int bufferSize = 4096 * 255;
            using (var fs1 = fi.Open(FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
            using (var fs2 = fi2.Open(FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
            using (var br1 = new BinaryReader(fs1))
            using (var br2 = new BinaryReader(fs2))
            {
                do
                {
                    byte[] buffer = br1.ReadBytes(bufferSize);
                    byte[] buffer2 = br2.ReadBytes(bufferSize);

                    if (buffer.Length != buffer2.Length)
                    {
                        throw new Exception($"unexpected mismatch between buffer and buffer2 lengths {buffer.Length} {buffer2.Length}");
                    }

                    for (int i = 0; i < buffer.Length; i++)
                    {
                        if (buffer[i] != buffer2[i])
                        {
                            return false;
                        }
                    }

                    eof = buffer.Length == 0;

                } while (!eof);
            }

            return true;
        }
    }
}