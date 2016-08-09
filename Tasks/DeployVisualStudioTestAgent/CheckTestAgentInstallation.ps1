function Check-Installation($ProductVersion)
{
    $agentPath = Locate-TestAgent
    if($agentPath -and $agentPath.Path)
    {
        $isProductExists = (Get-ChildItem $agentPath.Path).GetValue('Install') -eq '1'
        if($isProductExists)
        {
            Write-Verbose -Message ("Test Agent already exists") -verbose
        }
        return
    }
    Write-Verbose -Message ("Test Agent does not exists.") -verbose
}

Check-Installation -ProductVersion "14.0"