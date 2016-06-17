function Substitute-XMLAttributeValues
{

    Param(

        [String][Parameter(mandatory=$true)]
        $xmlFilePath,
        [Parameter(mandatory=$true)]
        $tags
    
    )

    Write-Verbose "XML file path = $xmlFilePath" 
   
    if ( -not ( Test-path $xmlFilePath ) ) {
        throw "XML file path '$xmlFilePath' doesn't exists."

    }
    
    # Extracting out content from xml file 
    $xmlContent = [xml](Get-Content $xmlFilePath)

    # For each tag , check if attributes and replace them if there is any user defined variable with same name
    foreach ( $tag in $tags )
    {
         Update-XMLNodeAttributes -xml $xmlContent.DocumentElement -tag $tag   
    }

    # Save changed xml content to xml file
    $xmlContent.Save($xmlFilePath)

}

function  Update-XMLNodeAttributes
{
    
    Param(
            
        [Xml.XmlElement][Parameter(mandatory=$true)] 
        $xml,
        [String][Parameter(mandatory=$true)] 
        $tag
          
    )

    # Get XML node for tag
    $node = $xml.SelectSingleNode("//$tag")
    
    # Reading environment variables [ ToDo : Remove ]
    <# $definedEnvVariables = Get-ChildItem Env: 

    $envVariablesToTest = @{}

    foreach( $envVar in $definedEnvVariables ) 
    {
        $envVariablesToTest.Add( $envVar.Name , $envVar.Value ) 
    } #>

    if( $node -eq $null )
    {
        Write-Verbose "Unable to find node with tag '$tag' in provided xml file" -Verbose
        return
    }
        
    foreach( $childNode in $node.ChildNodes )
    {   

        # Checks if any of attribute is defined as user variable in task context
        $childNodeAttributes = $childNode.Attributes


        foreach( $childNodeAttribute in $childNodeAttributes )
        {
            #$taskContextValueForAttribute = $envVariablesToTest.Get_Item($childNodeAttribute.Name) 
            $taskContextValueForAttribute = Get-VstsTaskVariable -Name $childNodeAttribute 
            if( $taskContextValueForAttribute ){
                $childNode.SetAttribute($childNodeAttribute.Name,$taskContextValueForAttribute)
            }
        }
        
        # Check for key value pair of attribute
        $valueForKeyAttribute = $childNode.GetAttribute("key")
        if( $valueForKeyAttribute )
        {
            $taskContextValueOfAttribute = Get-VstsTaskVariable -Name $valueForKeyAttribute
            #$taskContextValueOfKeyBasedAttribute = $envVariablesToTest.Get_Item($valueForKeyAttribute) 
            if( $taskContextValueForAttribute )
            {
                $childNode.SetAttribute("value",$taskContextValueOfKeyBasedAttribute)
            }

        }

    }  
        
}