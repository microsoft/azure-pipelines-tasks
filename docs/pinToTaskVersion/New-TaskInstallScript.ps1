[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$CollectionUrl,
    [Parameter(Mandatory = $true)]
    [string]$taskDir)

$ErrorActionPreference = 'Stop'

function Install-Task {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$CollectionUrl,

        [Parameter(Mandatory = $true)]
        $Task)

    "Installing task '$($Task.Name)' version '$($Task.Version)'."
    $url = "$($CollectionUrl.TrimEnd('/'))/_apis/distributedtask/tasks/$($Task.Id)/?overwrite=false&api-version=2.0"

    # Format the content.
    [byte[]]$bytes = [System.Convert]::FromBase64String($Task.Base64Zip)

    # Send the HTTP request.
    try {
        Invoke-RestMethod -Uri $url -Method Put -Body $bytes -UseDefaultCredentials -ContentType 'application/octet-stream' -Headers @{
            #'Authorization' = "Basic $([System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes(":$Pat")))"
            'X-TFS-FedAuthRedirect' = 'Suppress'
            'Content-Range' = "bytes 0-$($bytes.Length - 1)/$($bytes.Length)"
        }
    } catch {
        $details = $null
        try { $details = ConvertFrom-Json $_.ErrorDetails.Message }
        catch { }

        if ($details.TypeKey -eq 'TaskDefinitionExistsException') {
            Write-Warning $details.Message
        } else {
            throw
        }
    }
}

# Validate the directory exists.
if (!(Test-Path $taskDir -PathType Container)) {
    throw "Directory does not exist: '$taskDir'."
}

# Resolve the directory info.
$taskDir = Get-Item $taskDir

# Deserialize the task.json.
$manifest = Get-Item ([System.IO.Path]::Combine($taskDir, "task.json")) |
    Get-Content -Encoding UTF8 |
    Out-String |
    ConvertFrom-Json

# Get the zip bytes.
$zipFile = "$($taskDir.TrimEnd('/', '\')).temp.zip"
if ((Test-Path -LiteralPath $zipFile -PathType Leaf)) {
    Remove-Item -LiteralPath $zipFile
}

try {
    $items = Get-ChildItem -LiteralPath $taskDir |
        ForEach-Object { $_.FullName }
    Compress-Archive -Path $items -DestinationPath $zipFile
    $base64Zip = [System.Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Get-Item -LiteralPath $zipFile).FullName))
} finally {
    if ((Test-Path -LiteralPath $zipFile -PathType Leaf)) {
        Remove-Item -LiteralPath $zipFile
    }
}

# Embed the task into the script.
$id = "$($manifest.Id)"
$name = "$($manifest.Name)"
$version = "$($manifest.Version.Major).$($manifest.Version.Minor).$($manifest.Version.Patch)"
$task = @{
    Id = $id.Replace("'", "''")
    Name = $name.Replace("'", "''")
    Version = $version.Replace("'", "''")
    Base64Zip = $base64Zip
}

Install-Task -CollectionUrl $CollectionUrl -Task $task