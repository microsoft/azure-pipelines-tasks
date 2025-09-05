# Branch Cleanup Implementation Guide

This directory contains the complete implementation for the monthly branch cleanup policy for the `microsoft/azure-pipelines-tasks` repository.

## 🎯 Quick Start for Creating the Announcement Issue

Since this implementation cannot automatically create GitHub issues, follow these steps to create the announcement:

### Step 1: Create the Announcement Issue
1. Go to: https://github.com/microsoft/azure-pipelines-tasks/issues/new/choose
2. Select "Branch Cleanup Announcement" template
3. The title and description will be pre-filled
4. Review and customize the dates/details as needed
5. Add any specific branch exclusion requests if needed
6. Create the issue

### Step 2: Test the Cleanup Workflow
1. Go to: https://github.com/microsoft/azure-pipelines-tasks/actions/workflows/branch-cleanup.yml
2. Click "Run workflow"
3. Set parameters:
   - **months**: 24 (default)
   - **dry_run**: true (for testing)
   - **create_issue**: false (for initial testing)
4. Review the output to ensure it's working correctly

### Step 3: Enable Monthly Automation
The workflow is configured to run automatically on the first Monday of each month. No additional setup required.

## 📁 Files Created

### GitHub Templates & Workflows
- `.github/ISSUE_TEMPLATE/branch_cleanup_announcement.yml` - Issue template for announcements
- `.github/workflows/branch-cleanup.yml` - Production branch cleanup workflow

### Documentation
- `docs/branch-cleanup-policy.md` - Complete policy documentation
- `docs/branch-cleanup-README.md` - This implementation guide

## 🔧 Workflow Features

### Safety Features
- **Dry Run Mode**: Test without actually deleting branches
- **Protected Branches**: Automatic protection for important branch patterns
- **Comprehensive Logging**: Detailed logs of all operations
- **Error Handling**: Graceful handling of deletion failures

### Automation Features
- **Monthly Schedule**: Automatic execution on first Monday of each month
- **Manual Trigger**: On-demand execution via GitHub Actions
- **Issue Creation**: Automatic cleanup reports
- **Flexible Parameters**: Configurable retention period and options

### Protected Branch Patterns
The following branches will NEVER be deleted:
- `master` and `main`
- `release*` (all release branches)
- `Localize*` and `Localization*` (localization branches)

## 📊 Expected Results

Based on the analysis from the GitHub Action run referenced in the original request, the cleanup will affect approximately **1,436 branches** that are older than 24 months.

## ⚙️ Configuration Options

### Workflow Parameters (Manual Runs)
- **months**: Number of months for retention (default: 24)
- **dry_run**: Preview mode without actual deletion (default: true)
- **create_issue**: Whether to create a report issue (default: true)

### Scheduled Runs
- **When**: First Monday of every month at 2:00 AM UTC
- **Parameters**: Uses defaults (24 months, actual deletion, creates issues)
- **Permissions**: Requires `contents: write` and `issues: write`

## 🚨 Important Notes

1. **Test First**: Always run in dry-run mode before actual cleanup
2. **Grace Period**: Provide 30-day notice before first cleanup
3. **Local Copies**: Contributors should maintain local copies of important work
4. **Recovery**: Branch recovery may be possible immediately after deletion
5. **Monitoring**: Check workflow logs and created issues for results

## 🔄 Monthly Process

1. **Automatic Trigger**: Workflow runs on schedule
2. **Branch Analysis**: Identifies branches older than 24 months
3. **Protected Check**: Excludes all protected branch patterns
4. **Deletion**: Removes eligible branches
5. **Reporting**: Creates GitHub issue with results
6. **Notification**: Issue notifications alert repository watchers

## 📝 Maintenance

### Updating Protected Patterns
To add new protected branch patterns:
1. Edit `.github/workflows/branch-cleanup.yml`
2. Update the condition in the "Protected branches" section
3. Test with a dry run
4. Update the policy documentation

### Changing Schedule
To modify the cleanup schedule:
1. Edit the `cron` expression in the workflow file
2. Use https://crontab.guru/ to verify the schedule
3. Update documentation accordingly

## 🆘 Troubleshooting

### Workflow Fails
- Check GitHub Actions logs for detailed error messages
- Verify repository permissions
- Ensure GitHub token has sufficient permissions

### Branches Not Deleted
- Check if branch matches protected patterns
- Verify branch age calculation
- Review error messages in logs

### Issue Creation Fails
- Verify `issues: write` permission
- Check GitHub API rate limits
- Review issue template formatting

## 📞 Support

For questions or issues:
1. Review the GitHub Actions logs
2. Check the policy documentation
3. Create an issue using the branch cleanup template
4. Contact repository maintainers

---

**This implementation provides a complete, production-ready solution for automated branch cleanup with proper safety measures, reporting, and documentation.**