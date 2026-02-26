# Branch Cleanup Policy

## Overview

This document outlines the branch cleanup policy for the `microsoft/azure-pipelines-tasks` repository to maintain repository health, security, and performance.

## Policy Statement

**Effective Date**: [Date of implementation]

All branches in the `microsoft/azure-pipelines-tasks` repository that are older than **24 months** from their last commit date will be automatically deleted on a monthly basis, with specific exceptions for protected branch patterns.

## Scope

### Included Branches
- All user branches (e.g., `users/username/feature-name`)
- All feature branches
- All experimental branches
- Any branch not matching the protected patterns below

### Protected Branches (Never Deleted)
The following branch patterns are **permanently protected** from automatic cleanup:
- `master` - Main development branch
- `main` - Alternative main branch name
- `release*` - All release branches (e.g., `releases/m158`, `release-v1.0`)
- `Localize*` - Localization branches
- `Localization*` - Alternative localization branch naming

## Cleanup Schedule

### Automated Cleanup
- **Frequency**: Monthly
- **Schedule**: First Monday of every month at 2:00 AM UTC
- **Process**: Fully automated via GitHub Actions

### Manual Cleanup
Repository maintainers may trigger manual cleanup at any time via:
- GitHub Actions workflow dispatch
- Emergency cleanup procedures

## Implementation

### Workflow Details
- **Workflow File**: `.github/workflows/branch-cleanup.yml`
- **Dry Run Mode**: Available for testing and preview
- **Reporting**: Automatic issue creation with cleanup reports
- **Permissions**: Requires `contents: write` and `issues: write`

### Safety Measures
1. **Grace Period**: 30-day notice before first implementation
2. **Dry Run Testing**: Extensive testing in preview mode
3. **Protected Patterns**: Robust pattern matching for protected branches
4. **Error Handling**: Graceful failure handling for protected or already-deleted branches
5. **Audit Trail**: Complete logging and GitHub issue reports

## Branch Retention Guidelines

### For Contributors
- **Active Development**: Keep branches current if actively working on them
- **Completed Work**: 
  - Merge completed features via pull requests
  - Delete branches after successful merges
  - Use Git tags for important milestones
- **Long-term Storage**: Use local repositories for personal archive needs

### For Maintainers
- **Release Branches**: Follow `release*` naming convention for automatic protection
- **Important Branches**: Add to protected patterns if needed
- **Historical Branches**: Tag important commits before allowing cleanup

## Exceptions and Special Cases

### Requesting Protection
If a branch should be protected from cleanup:
1. **Create an Issue**: Use the branch cleanup announcement template
2. **Provide Justification**: Explain why the branch should be preserved
3. **Timeline**: Requests must be made during grace periods
4. **Review Process**: Maintainers will review and decide on protection

### Emergency Recovery
If a branch is deleted in error:
1. **Check Local Copies**: Contributors should maintain local copies
2. **Recovery Request**: Create an issue with branch details
3. **Restoration**: May be possible if deletion was recent

## Monitoring and Reporting

### Automated Reports
- **Cleanup Reports**: Automatic GitHub issues with deletion lists
- **Statistics**: Branch counts and cleanup metrics
- **Notifications**: Issue notifications to repository watchers

### Manual Monitoring
- **Workflow Logs**: Detailed logs in GitHub Actions
- **Branch Analytics**: Regular analysis of branch growth and cleanup effectiveness

## Compliance and Governance

### Security Benefits
- **Vulnerability Reduction**: Removes branches with outdated dependencies
- **Surface Area Reduction**: Fewer branches reduce potential attack vectors
- **Audit Compliance**: Systematic cleanup supports audit requirements

### Performance Benefits
- **Repository Size**: Reduced clone times and storage requirements
- **Git Operations**: Faster branch listings and operations
- **CI/CD Performance**: Improved workflow performance

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|---------|
| [Date] | 1.0 | Initial policy creation | GitHub Copilot |

## Related Documents

- [Branch Cleanup Workflow](../.github/workflows/branch-cleanup.yml)
- [Issue Template](../.github/ISSUE_TEMPLATE/branch_cleanup_announcement.yml)
- [Contributing Guidelines](../CONTRIBUTING.md)

## Contact

For questions about this policy:
- Create an issue using the branch cleanup announcement template
- Contact repository maintainers
- Review the GitHub Actions workflow for technical details