function Get-SingleFile($files, $pattern)
{
    if ($files -is [system.array])
    {
        throw "Found more than one file to deploy with search pattern $pattern. There can be only one."
    }
    else
    {
        if (!$files)
        {
            throw "No files were found to deploy with search pattern $pattern"
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
        Throw "Please specify a complete and a valid template file path"
    }

    if ($csmParametersFile -ne $env:BUILD_SOURCESDIRECTORY -and !(Test-Path -Path $csmParametersFile -PathType Leaf))
    {
         Throw "Please specify a complete and a valid template parameters file path"
    }
}

function Get-CsmParameterObject
{
    param([string]$csmParameterFileContent,
          [string]$overrideParameters)

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

        if ([string]::IsNullOrEmpty($overrideParameters) -eq $false)
        {
            $paramsList = New-Object System.Collections.Generic.List[string]

            $paramsList = $overrideParameters.Split(" ") | Where-Object {$_.Contains(" ") -eq $false} | Where-Object {$_.Length -gt 0}

            for($i = 0; $i -lt $paramsList.Count - 1; $i = $i+2)
            {
                if($paramsList[$i][0] -ne '-' -or $paramsList[$i+1] -eq $null)
                {
                    Throw "Specified argument list is not in the correct format"
                }
            
                $parameterName = $paramsList[$i].TrimStart('-')
                Write-Verbose "Overwrote the parameter $parameterName from the input" -Verbose
                $newParametersObject[$parameterName] = Get-Variable -Name $paramsList[$i + 1].TrimStart('$') -ValueOnly
		
            }
        }

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
            Throw "Please specify valid username"
        }

        if([string]::IsNullOrEmpty($vmPassword) -eq $true)
        {
            Throw "Please specify valid password"
        }
    }

}