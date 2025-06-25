# TasksVersions.ps1 Documentation

## Overview
`ListTasksVersions.ps1` is a PowerShell script designed to list all unique versions of an Azure Pipelines task and show the commit link for each version. It also allows searching for a specific version based on `Major`, `Minor`, and `Patch` parameters.

## Features
- List all versions of a task.
- Search for a specific version using `Major`, `Minor`, and `Patch` parameters.
- Displays error messages for invalid or missing inputs.
## How to Run the Script

There are two ways to run the script:

### 1. Parameterized (Non-Interactive) Mode
You provide all required parameters directly on the command line. This is useful for automation or scripting.

**Examples:**
- List all versions of a task:
  ```powershell
  pwsh ./ListTasksVersions.ps1 -TaskName CopyFilesV2
  ```
- Search for a specific version:
  ```powershell
  pwsh ./ListTasksVersions.ps1 -TaskName CopyFilesV2 -Version 2.238.0
  ```
  
- Search for a specific version and show release info:
  ```powershell
  pwsh ./ListTasksVersions.ps1 -TaskName CopyFilesV2 -Version 2.238.0 -ShowRelease
  ```

### 2. Interactive Mode
If you do not provide required parameters, the script will prompt you for input. This is user-friendly for manual use.

**Example:**
- Run the script without parameters:
  ```powershell
  pwsh ./ListTasksVersions.ps1
  ```
- The script will prompt you to:
  1. Choose to view all versions or search for a specific version.
  2. Enter the task name.
  3. (If searching) Enter the version numbers.
  4. Choose whether to display release information (y/n).

Each case is handled automatically based on your input.
## Usage

### Parameters
- **TaskName**: The name of the task (e.g., `CopyFilesV2`).
- **Major**: The major version number.
- **Minor**: The minor version number.
- **Patch**: The patch version number.
- **ShowRelease**: Switch. If specified, displays release (Git tag) information for each version. If not provided, the script will prompt you in interactive mode.

### Behaviors
#### View All Versions
1. Run the script.
2. Select the option to view all versions.
3. Enter the task name.
4. When prompted, choose whether to display release information (enter 'y' or 'n').
5. The script lists all versions of the task, including release info if selected.

#### Search for a Specific Version
1. Run the script.
2. Select the option to search for a specific version.
3. Enter the task name.
4. Provide values for `Major`, `Minor`, and `Patch`.
5. When prompted, choose whether to display release information (enter 'y' or 'n').
6. If any parameter is missing, the script displays an error and exits.
7. If all parameters are provided, the script searches for the exact version and displays the result, including release info if selected.

#### Error Handling
- If the task name is empty, the script displays an error:
  ```
  Task name cannot be empty. Please provide a valid task name.
  ```

- If the task does not exist, the script displays an error:
  ```
  Task not found: <TaskName>. Please check the task name and try again.
  ```

- If any version parameter (`Major`, `Minor`, or `Patch`) is missing during a search, the script displays an error:
  ```
  All parameters (Major, Minor, Patch) are required for search. Please provide valid values.
  ```

## Notes
- Ensure the `task.json` file exists in the `Tasks/<TaskName>/` directory.
- The script requires PowerShell to run.
- Release Information is only available in search mode.

