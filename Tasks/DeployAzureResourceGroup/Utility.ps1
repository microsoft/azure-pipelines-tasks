function Get-SingleFile($files, $pattern)
{
    if ($files -is [system.array])
    {
        throw (Get-LocalizedString -Key "Found more than one file to deploy with search pattern '{0}'. There can be only one" -ArgumentList $pattern)
    }
    else
    {
        if (!$files)
        {
            throw (Get-LocalizedString -Key "No files were found to deploy with search pattern '{0}'" -ArgumentList $pattern)
        }

        return $files
    }
}

function Get-File($pattern)
{
    #Find the File based on pattern

    Write-Verbose -Verbose "Finding files based on $pattern"
    $filesMatchingPattern = Find-Files -SearchPattern "$pattern"

    Write-Verbose -Verbose "Files Matching Pattern: $filesMatchingPattern"

    #Ensure that at most a single file is found
    $file = Get-SingleFile $filesMatchingPattern $pattern

    return $file
}

function Validate-DeploymentFileAndParameters
{
    param([string]$csmFile,
          [string]$csmParametersFile)

    if (!(Test-Path -Path $csmFile -PathType Leaf))
    {
        throw (Get-LocalizedString -Key "Please specify a complete and a valid template file path")
    }

    if ($csmParametersFile -ne $env:BUILD_SOURCESDIRECTORY -and !(Test-Path -Path $csmParametersFile -PathType Leaf))
    {
         throw (Get-LocalizedString -Key "Please specify a complete and a valid template parameters file path")
    }
}

function Get-CsmParameterObject
{
    param([string]$csmParameterFileContent)

    if ([string]::IsNullOrEmpty($csmParameterFileContent) -eq $false)
    {
        Write-Verbose "Generating csm parameter object" -Verbose

        $csmJObject = [Newtonsoft.Json.Linq.JObject]::Parse($csmParameterFileContent)
        $newParametersObject = New-Object System.Collections.Hashtable([System.StringComparer]::InvariantCultureIgnoreCase)
        
        if($csmJObject.ContainsKey("parameters") -eq $true)
        {
            $parameters = $csmJObject.GetValue("parameters")
            $parametersObject  = $parameters.ToObject([System.Collections.Hashtable])
        }
        else
        {
            $parametersObject = $csmJObject.ToObject([System.Collections.Hashtable])
        }

        foreach($key in $parametersObject.Keys)
        {
            $parameterValue = $parametersObject[$key] -as [Newtonsoft.Json.Linq.JObject]
            $newParametersObject.Add($key, $parameterValue["value"].ToString())
        }

        Write-Verbose "Generated the parameter object" -Verbose

        return $newParametersObject
    }
}

function Validate-Credentials
{
    param([string]$vmCreds,
          [string]$vmUserName,
          [string]$vmPassword)

    if ($vmCreds -eq "true")
    {
        if([string]::IsNullOrEmpty($vmUserName) -eq $true)
        {
            throw (Get-LocalizedString -Key "Please specify valid username")
        }

        if([string]::IsNullOrEmpty($vmPassword) -eq $true)
        {
            throw (Get-LocalizedString -Key "Please specify valid password")
        }
    }

}