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
    param([string]$csmParameterFileContent)

    if ([string]::IsNullOrEmpty($csmParameterFileContent) -eq $false)
    {
        Write-Verbose -Verbose "Generating csm parameter object"

        $csmJObject = [Newtonsoft.Json.Linq.JObject]::Parse($csmParameterFileContent)
        $parameters = $csmJObject.GetValue("parameters")
        $parametersObject  = $parameters.ToObject([System.Collections.Hashtable])

        $newParametersObject = New-Object 'System.Collections.Hashtable'

        foreach($key in $parametersObject.Keys)
        {
            $parameterValue = $parametersObject[$key] -as [Newtonsoft.Json.Linq.JObject]
            $newParametersObject.Add($key, $parameterValue["value"].ToString())
        }

        Write-Verbose -Verbose "Generated the parameter object."

        return $newParametersObject
    }
}