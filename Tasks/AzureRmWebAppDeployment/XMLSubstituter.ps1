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
         # Get XML node for tag
         $node = $xmlContent.SelectSingleNode("//$tag")

         if( $node -eq $null )
         {
             Write-Verbose "Unable to find node with tag '$tag' in provided xml file" 
             continue
         }
         
         if( $node.LocalName -eq "configSections" )
         {
            Update-ConfigXMLNodeAttributes -xmlContent $xmlContent -node $node
         }
         else
         {
            Update-XMLNodeAttributes -node $node   
         }

    }

    # Save changed xml content to xml file
    $xmlContent.Save($xmlFilePath)

}

function  Update-ConfigXMLNodeAttributes
{
    
    Param(
            
        [Object][Parameter(mandatory=$true)] 
        $xmlContent,
        [Object][Parameter(mandatory=$true)] 
        $node

    )

    # Get all section nodes 
    $sections = $node.SelectNodes("//section");
     
    foreach( $section in $sections )
    {
        $sectionLocalName = $section.name
        $customNode = $xmlContent.SelectSingleNode("//$sectionLocalName")
        Update-XMLNodeAttributes -node $customNode
    }
    
}



function  Update-XMLNodeAttributes
{
    
    Param(
            
        [Object][Parameter(mandatory=$true)] 
        $node

    )
    
    if( $node -eq $null )
    {
        Write-Verbose "Unable to find node with tag '$tag' in provided xml file" -Verbose
        return
    }
        
    foreach( $childNode in $node.ChildNodes )
    {   

        if( $childNode.LocalName -eq "#comment" )
        {
            continue
        }

        # Checks if any of attribute is defined as user variable in task context
        $childNodeAttributes = $childNode.Attributes

        
        foreach( $childNodeAttribute in $childNodeAttributes )
        {
            
            $taskContextValueForAttribute = Get-VstsTaskVariable -Name $childNodeAttribute.Name 
            if( $taskContextValueForAttribute ){
                $childNode.SetAttribute($childNodeAttribute.Name,$taskContextValueForAttribute)
            }
        }
        
        # Check for key value pair of attribute
        $valueForKeyAttribute = $childNode.GetAttribute("key")
        if( $valueForKeyAttribute )
        {
            $taskContextValueOfKeyBasedAttribute = Get-VstsTaskVariable -Name $valueForKeyAttribute
            if( $taskContextValueOfKeyBasedAttribute )
            {
                $childNode.SetAttribute("value",$taskContextValueOfKeyBasedAttribute)
            }
        }
    }  
        
}