namespace BuildConfigGen
{
    internal static class Helpers
    {

        internal static bool FilesEqual(string sourcePath, string targetPath)
        {
            FileInfo fi = new FileInfo(sourcePath);
            FileInfo fi2 = new FileInfo(targetPath);

            int mismatchChars = 10;
            bool ret = true;

            if (!fi2.Exists)
            {
                return false;
            }

            if (fi.Length != fi2.Length)
            {
                Console.WriteLine($"mismatch {fi.Length}!={fi2.Length}");
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
                    // use BinaryReader.ReadBytes to guarantee the size of the buffer matches between buffer1 and buffer2.  Stream.ReadBytes doesn’t guarantee reading up to bufferSize
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
                            Console.WriteLine($"mismatch buffer[i={i}]={(int)buffer[i]} != {(int)buffer2[i]}");
                            ret = false;
                            mismatchChars--;
                            if (mismatchChars < 1)
                            {
                                return false;
                            }
                        }
                    }

                    eof = buffer.Length == 0;

                } while (!eof);
            }

            return ret;
        }
    }
}