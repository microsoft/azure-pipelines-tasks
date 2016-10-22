# Telemetry Codes
$telemetryCodes = 
@{
  "Input_Validation" = "Input_Validation_Error";
  "Task_InternalError" = "Task_InternalError";
  "DTLSDK_Error" = "DTL_SDK_ERROR";  
 }

 # Telemetry Write Method
function Write-Telemetry
{
  [CmdletBinding()]
  param(
    [Parameter(Mandatory=$True,Position=1)]
    [string]$codeKey,

    [Parameter(Mandatory=$True,Position=2)]
    [string]$errorMsg
    )
  
  $erroCodeMsg = $telemetryCodes[$codeKey]
  $erroCode = ('"{0}":{1}' -f $erroCodeMsg, $errorMsg)
  ## Form errorcode as json string 
  $erroCode = '{' + $erroCode + '}'
  
  $telemetryString = "##vso[task.logissue type=error;code=" + $erroCode + ";]"
  Write-Host $telemetryString
}