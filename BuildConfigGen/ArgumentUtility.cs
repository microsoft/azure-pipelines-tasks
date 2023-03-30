internal class ArgumentUtility
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

