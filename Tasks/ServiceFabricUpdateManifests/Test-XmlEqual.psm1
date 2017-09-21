function Test-XmlEqual
{
    [CmdletBinding()]
    [OutputType([bool])]
    Param
    (
        [Parameter(Mandatory=$true)]
        [System.Xml.XmlNode]
        $Item1,

        [Parameter(Mandatory=$true)]
        [System.Xml.XmlNode]
        $Item2
    )

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        Add-Type -AssemblyName System.Xml.Linq

        $xmlReader1 = [System.Xml.XmlNodeReader] $Item1
        $xmlReader2 = [System.Xml.XmlNodeReader] $Item2

        $xDoc1 = [System.Xml.Linq.XDocument]::Load($xmlReader1)
        $xDoc2 = [System.Xml.Linq.XDocument]::Load($xmlReader2)

        [System.Xml.Linq.XNode]::DeepEquals($xDoc1, $xDoc2)
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}