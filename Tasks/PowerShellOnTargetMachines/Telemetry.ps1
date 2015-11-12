# TELEMETRY CODES
$telemetryCodes = 
@{"PREREQ_NoWinRMHTTP_Port" = "PREREQ001";
  "PREREQ_NoWinRMHTTPSPort" = "PREREQ002";
  "PREREQ_NoResources" = "PREREQ003";
  "UNKNOWNPREDEP_Error" = "UNKNOWNPREDEP001";
  "DEPLOYMENT_Failed" = "DEP001"
 }

# TELEMETRY FUNCTION - should we put this in agent module?
function Write-Telemetry
{
  [CmdletBinding()]
  param(
    [Parameter(Mandatory=$True,Position=1)]
    [string]$codeKey
    )

  $code = $telemetryCodes[$codeKey]
  $telemetryString = "##vso[task.logissue type=error;code=" + $code + ";TaskId=3B5693D4-5777-4FEE-862A-BD2B7A374C68;]"
  Write-Host $telemetryString
  $telemetrySet = $true
}