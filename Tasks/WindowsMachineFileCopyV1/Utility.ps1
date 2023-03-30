function ThrowError
{
    param([string]$errorMessage)
  
        throw "$errorMessage"
}

function Get-ResourceConnectionDetails
{
    param(
        [string]$envName,
        [object]$resource
        )

    $resourceProperties = @{}

    $resourceName = $resource.Name
    $resourceId = $resource.Id

    Write-Verbose "`t`t Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceFQDNKeyName"
    $fqdn = Get-EnvironmentProperty -Environment $environment -Key $resourceFQDNKeyName -ResourceId $resourceId -ErrorAction Stop
    Write-Verbose "`t`t Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceFQDNKeyName"

    Write-Verbose "`t`t Resource fqdn - $fqdn"	

    $resourceProperties.fqdn = $fqdn
    $resourceProperties.credential = Get-ResourceCredentials -resource $resource    

    return $resourceProperties
}

function Get-ResourcesProperties
{
    param(
        [string]$envName,
        [object]$resources
        )    

    [hashtable]$resourcesPropertyBag = @{}

    foreach ($resource in $resources)
    {
        $resourceName = $resource.Name
        $resourceId = $resource.Id
        Write-Verbose "Get Resource properties for $resourceName (ResourceId = $resourceId)"		

        # Get other connection details for resource like - fqdn wirmport, http protocol, skipCACheckOption, resource credentials

        $resourceProperties = Get-ResourceConnectionDetails -envName $envName -resource $resource        
        
        $resourcesPropertyBag.Add($resourceId, $resourceProperties)
    }
    return $resourcesPropertyBag
}

function Validate-Null(
    [string]$value,
    [string]$variableName
    )
{
    $value = $value.Trim()
    if(-not $value)
    {
        ThrowError -errorMessage (Get-LocalizedString -Key "Parameter '{0}' cannot be null or empty." -ArgumentList $variableName)
    }
}

function Validate-SourcePath(
    [string]$value
    )
{
    Validate-Null -value $value -variableName "sourcePath"

    if(-not (Test-Path -LiteralPath $value))
    {
        ThrowError -errorMessage (Get-LocalizedString -Key "Source path '{0}' does not exist." -ArgumentList $value)
    }
}

function Validate-DestinationPath(
    [string]$value,
    [string]$environmentName
    )
{
    Validate-Null -value $value -variableName "targetPath"

    if($environmentName -and $value.StartsWith("`$env:"))
    {
        ThrowError -errorMessage (Get-LocalizedString -Key "Remote destination path '{0}' cannot contain environment variables." -ArgumentList $value)
    }
}

function Validate-AdditionalArguments([string]$additionalArguments)
{    
    if($additionalArguments -match "[&;]")
    {
        ThrowError -errorMessage (Get-LocalizedString -Key "Additional arguments can't include separator characters '&' and ';'. Please verify input. To learn more about argument validation, please check https://aka.ms/azdo-task-argument-validation")
    }
}

# $sourcePath, $targetPath, $credential, $cleanTargetBeforeCopy, $additionalArguments
# $adminUserName, $adminPassword
function Copy-OnLocalMachine(
    [string] $sourcePath,
    [string] $targetPath,
    [string] $adminUserName,
    [string] $adminPassword,
    [string] $cleanTargetBeforeCopy,
    [string] $additionalArguments
    )
{
    $credential = New-Object 'System.Net.NetworkCredential' -ArgumentList $adminUserName, $adminPassword
    Invoke-Command -ScriptBlock $CopyJob -ArgumentList "", $sourcePath, $targetPath, $credential, $cleanTargetBeforeCopy, $additionalArguments
}