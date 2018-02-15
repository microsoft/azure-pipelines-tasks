# Telemetry Codes
$telemetryCodes = 
@{
  "Input_Validation" = "Input_Validation_Error";
  "Task_InternalError" = "Task_Internal_Error";
  "DTLSDK_Error" = "Dtl_Sdk_Error";  
 }

 # Telemetry Write Method
function Write-Telemetry
{
 [CmdletBinding()]
  param(
    [Parameter(Mandatory=$True,Position=1)]
    [string]$codeKey,

    [Parameter(Position=2)]
    [string]$errorMsg
    )
  
  $erroCodeMsg = $telemetryCodes[$codeKey]
  
  ## If no error is passed mark it as not available
  if([string]::IsNullOrEmpty($errorMsg))
  {
    $errorMsg = "No error details available"
  }
  $erroCode = ('"{0}":{1}' -f $erroCodeMsg, $errorMsg)
  ## Form errorcode as json string 
  $erroCode = '{' + $erroCode + '}'
  
  $telemetryString = "##vso[task.logissue type=error;code=" + $erroCode + ";]"
  Write-Host $telemetryString
}

# Export only the public function.
Export-ModuleMember -Function Write-Telemetry
Export-ModuleMember -Variable telemetryCodes