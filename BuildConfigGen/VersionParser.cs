internal static class VersionParser
{

    public static void ParseVersion(
        String version,
        out Int32 major,
        out Int32 minor,
        out Int32 patch,
        out String? semanticVersion)
    {
        // Instance(default) - lifecycle is within this method
        RuntimeTests.Instance(default).VersionParser_ParseVersion.Precondition(version);
        RuntimeTests.Instance(default).VersionParser_ParseVersion_InvalidMajor.Precondition(version);

        ArgumentUtility.CheckStringForNullOrEmpty(version, "version");

        String[] segments = version.Split(new char[] { '.', '-' }, StringSplitOptions.None);
        if (segments.Length < 3 || segments.Length > 4)
        {
            throw new ArgumentException("wrong number of segments");
        }

        if (!Int32.TryParse(segments[0], out major))
        {
            RuntimeTests.Instance(default).VersionParser_ParseVersion_InvalidMajor.AssertPass();
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

        RuntimeTests.Instance(default).VersionParser_ParseVersion.AssertEquals(major).AssertEquals(minor).AssertEquals(patch).Done();

    }
}

