param (
    [string][Parameter(Mandatory=$true)]$ConnectedServiceNameARM,
    [string][Parameter(Mandatory=$true)]$WebSiteName,    
    [string][Parameter(Mandatory=$true)]$Files,
    [string]$RemoveAdditionalFilesFlag,
    [string]$DeleteFilesInAppDataFlag,
    [string]$TakeAppOfflineFlag,
    [string]$PhysicalPath
)