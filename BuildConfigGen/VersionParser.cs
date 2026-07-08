using System.Diagnostics.CodeAnalysis;

public static class VersionParser
{
    /// <summary>
    /// Splits the full Semver 2.0 string into individual string components: version, pre-release version, and build version.
    /// The actual values are not validated for Semver 2.0 version compliance.
    /// </summary>
    /// <param name="fullVersion">The complete version string, e.g. 1.2.3-test+node</param>
    /// <param name="versionSegment">The version from the <paramref name="fullVersion"/>, e.g. 1.2.3</param>
    /// <param name="preReleaseSegment">The prerelease version from the <paramref name="fullVersion"/>, e.g. test</param>
    /// <param name="buildSegment">The build version from the <paramref name="fullVersion"/>, e.g. node</param>
    /// <returns></returns>
    public static bool TryParseVersionComponents(
        string fullVersion,
        [NotNullWhen(returnValue: true)] out string? versionSegment,
        out string? preReleaseSegment,
        out string? buildSegment)
    {
        versionSegment = null;
        preReleaseSegment = null;
        buildSegment = null;

        if (string.IsNullOrWhiteSpace(fullVersion))
        {
            return false;
        }

        int buildIndex = fullVersion.IndexOf('+');
        if (buildIndex == 0)
        {
            return false;
        }

        int preReleaseIndex = fullVersion.IndexOf('-');
        if (preReleaseIndex == 0)
        {
            return false;
        }

        if (preReleaseIndex > 0 && buildIndex > 0)
        {
            if (preReleaseIndex > buildIndex)
            {
                // Prelease must be defined before first '+', if any.
                // Everything which comes after + is a build version.
                preReleaseIndex = -1;
            }
        }

        string? preReleaseSegmentCandidate = preReleaseIndex > 0
            ? fullVersion.Substring(preReleaseIndex + 1, buildIndex > 0 ? buildIndex - preReleaseIndex - 1 : fullVersion.Length - preReleaseIndex - 1)
            : null;

        if (preReleaseSegmentCandidate != null && preReleaseSegmentCandidate.Length < 1)
        {
            return false;
        }

        string? buildSegmentCandidate = buildIndex > 0
            ? fullVersion.Substring(buildIndex + 1)
            : null;

        if (buildSegmentCandidate != null && buildSegmentCandidate.Length < 1)
        {
            return false;
        }

        versionSegment = fullVersion;
        if (preReleaseIndex > 0)
        {
            versionSegment = versionSegment.Substring(0, preReleaseIndex);
        }
        else if (buildIndex > 0)
        {
            versionSegment = versionSegment.Substring(0, buildIndex);
        }

        buildSegment = buildSegmentCandidate;
        preReleaseSegment = preReleaseSegmentCandidate;

        return true;
    }

    /// <summary>
    /// There should be more validation in this type, but it is impossible to say whether it would be breaking or not.
    /// Therefore, we leave the conditions relaxed, as-is, not to increase the scope of this change significantly.
    /// </summary>
    public static void ParseVersion(
        string version,
        out int major,
        out int minor,
        out int patch,
        out string? preReleaseVersion,
        out string? buildVersion)
    {
        ArgumentUtility.CheckStringForNullOrEmpty(version, nameof(version));

        if (!TryParseVersionComponents(
            version,
            out string? mainVersion,
            out preReleaseVersion,
            out buildVersion))
        {
            throw new ArgumentException($"Could not parse version segments: '{version}'");
        }

        string[] dotSegments = mainVersion?.Split(c_versionSeparator, StringSplitOptions.None) ?? [];

        if (dotSegments.Length != 3)
        {
            throw new ArgumentException("wrong number of segments (should be 3) in: '" + version + "'");
        }

        if (!int.TryParse(dotSegments[0], out major))
        {
            throw new ArgumentException("major");
        }

        if (!int.TryParse(dotSegments[1], out minor))
        {
            throw new ArgumentException("minor");
        }

        if (!int.TryParse(dotSegments[2], out patch))
        {
            throw new ArgumentException("patch");
        }
    }

    private static readonly char[] c_versionSeparator = ['.'];
}
