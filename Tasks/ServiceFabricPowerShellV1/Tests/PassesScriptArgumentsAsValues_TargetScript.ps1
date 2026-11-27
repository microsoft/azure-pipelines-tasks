param($Name, [switch]$Force, $Count, $Settings)

# Return key information.
New-Object psobject -Property @{
    Name = $Name
    Force = $Force
    Count = $Count
    Settings = $Settings
    Args = $args
}
