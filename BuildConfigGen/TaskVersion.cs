using System.Globalization;
using System.Text;

public class TaskVersion : IComparable<TaskVersion>, IEquatable<TaskVersion>
{
    public TaskVersion(string version)
    {
        VersionParser.ParseVersion(
            version,
            out int major,
            out int minor,
            out int patch,
            out string? preRelease,
            out string? build);

        Major = major;
        Minor = minor;
        Patch = patch;
        Build = build;

        if (string.Equals(preRelease, TestBuildVersion, StringComparison.OrdinalIgnoreCase))
        {
            // For backwards compatibility
            IsTest = true;
        }
        else if (!string.IsNullOrEmpty(preRelease))
        {
            // This condition is there to prevent backwards compatibility problems if we have to roll this change back.
            // We are not going to relax the condition until the rollout is successful.
            throw new ArgumentException("semVer");
        }
    }
    public TaskVersion(int major, int minor, int overidePatch, string? build = null)
    {
        if (overidePatch < 0)
        {
            throw new Exception($"Bug, overridePatch must be >=0, got {overidePatch}");
        }

        Major = major;
        Minor = minor;
        Patch = overidePatch;
        Build = build;
    }

    private TaskVersion(TaskVersion taskVersionToClone)
    {
        Major = taskVersionToClone.Major;
        Minor = taskVersionToClone.Minor;
        Patch = taskVersionToClone.Patch;
        Build = taskVersionToClone.Build;
        IsTest = taskVersionToClone.IsTest;
    }

    public int Major { get; }

    public int Minor { get; }

    public int Patch { get; }

    public string? Build { get; }

    public bool IsTest { get; }

    public TaskVersion Clone()
    {
        return new TaskVersion(this);
    }

    public TaskVersion CloneWithMinorAndPatch(int minor, int overridePatch)
    {
        return new TaskVersion(Major, minor, overridePatch, Build);
    }

    public TaskVersion CloneWithPatch(int overridePatch)
    {
        return new TaskVersion(Major, Minor, overridePatch, Build);
    }

    public TaskVersion CloneWithMajor(int major)
    {
        return new TaskVersion(major, Minor, Patch, Build);
    }

    public TaskVersion CloneWithBuild(string? build)
    {
        return new TaskVersion(Major, Minor, Patch, build);
    }

    public static implicit operator String(TaskVersion version)
    {
        return version.ToString();
    }

    internal string MinorPatchToString()
    {
        String suffix = String.Empty;
        if (IsTest)
        {
            throw new NotImplementedException();
        }

        return String.Format(CultureInfo.InvariantCulture, "{1}.{2}{3}", Major, Minor, Patch, suffix);
    }

    public override string ToString()
    {
        StringBuilder sb = new StringBuilder()
            .Append(Major).Append('.').Append(Minor).Append('.').Append(Patch);

        if (!string.IsNullOrEmpty(Build))
        {
            sb = sb.Append('+').Append(Build);
        }

        return sb.ToString();
    }

    public override int GetHashCode() => ToString().GetHashCode();

    public int CompareTo(TaskVersion? other)
    {
        if (other is null)
        {
            throw new ArgumentNullException(nameof(other));
        }

        int rc = Major.CompareTo(other.Major);
        if (rc != 0)
        {
            return rc;
        }

        rc = Minor.CompareTo(other.Minor);
        if (rc != 0)
        {
            return rc;
        }

        rc = Patch.CompareTo(other.Patch);
        if (rc != 0)
        {
            return rc;
        }

        if (rc != 0)
        {
            return rc;
        }

        return string.IsNullOrEmpty(Build) && !string.IsNullOrEmpty(other.Build) ? 1
             : !string.IsNullOrEmpty(Build) && string.IsNullOrEmpty(other.Build) ? -1
             : 0; // build versions are incomparable, but the default should always go first
    }

    public Boolean Equals(TaskVersion? other)
    {
        if (other is null)
        {
            return false;
        }

        return Major == other.Major
            && Minor == other.Minor
            && Patch == other.Patch
            && IsTest == other.IsTest
            && string.Equals(Build, other.Build, StringComparison.Ordinal);
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

    public static bool operator !=(TaskVersion v1, TaskVersion v2)
    {
        if (v1 is null)
        {
            return !(v2 is null);
        }

        return !v1.Equals(v2);
    }

    public static bool operator <(TaskVersion v1, TaskVersion v2)
    {
        ArgumentUtility.CheckForNull(v1, nameof(v1));
        ArgumentUtility.CheckForNull(v2, nameof(v2));
        return v1.CompareTo(v2) < 0;
    }

    public static bool operator >(TaskVersion v1, TaskVersion v2)
    {
        ArgumentUtility.CheckForNull(v1, nameof(v1));
        ArgumentUtility.CheckForNull(v2, nameof(v2));
        return v1.CompareTo(v2) > 0;
    }

    public static bool operator <=(TaskVersion v1, TaskVersion v2)
    {
        ArgumentUtility.CheckForNull(v1, nameof(v1));
        ArgumentUtility.CheckForNull(v2, nameof(v2));
        return v1.CompareTo(v2) <= 0;
    }

    public static bool operator >=(TaskVersion v1, TaskVersion v2)
    {
        ArgumentUtility.CheckForNull(v1, nameof(v1));
        ArgumentUtility.CheckForNull(v2, nameof(v2));
        return v1.CompareTo(v2) >= 0;
    }

    public const string TestBuildVersion = "test";
}
