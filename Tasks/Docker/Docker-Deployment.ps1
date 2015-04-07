[CmdletBinding(DefaultParameterSetName = 'None')]
param
(
    [String] [Parameter(Mandatory = $true)]
    $DockerEndpoint,
    
    [String] [Parameter(Mandatory = $true)]
    $Repository,

    [String] [Parameter(Mandatory = $false)]
    $Tag="latest",

    [String] [Parameter(Mandatory = $true)]
    $ContainerName,

    [String] [Parameter(Mandatory = $false)]
    $PortBindings
)

Write-Host "Entering script Docker-Deployment.ps1"
Write-Host "DockerHost= $DockerEndpoint"
Write-Host "Repository= $Repository"
Write-Host "Tag= $Tag"
Write-Host "ContainerName= $ContainerName"
Write-Host "PortBindings= $PortBindings"

# VARIABLE DECLARATIONS
$DockerEndpointRestUrl = ("http://{0}" -f $DockerEndpoint.Trim())
$hostPort = $null
$containerPort = $null
$jsonContentType = "application/json"

# Images
$imagesRestUrl = ("{0}/images" -f $DockerEndpointRestUrl)
$createImageRestUrl	= ("$DockerEndpointRestUrl/images/create?fromImage={0}")
$isImageExists = $true

# Containers
$containerRestUrl = ("{0}/containers" -f $DockerEndpointRestUrl)
$createContainerRestUrl	= ("{0}/create?name={1}" -f $containerRestUrl, $ContainerName)
$startContainerRestUrl = ("$containerRestUrl/{0}/start")
$deleteContainerRestUrl	= ("$containerRestUrl/{0}?force=1")


# Error Mwssages
$notFoundErrorCode = "404"
$conflictErrorCode = "409"

$createContainerRestPayload = @"
{{ 
  "Entrypoint": "",
  "Image": "{0}"{1}
}}
"@

$exposedPorts = @"
,
"ExposedPorts": {{
"{0}/tcp": {{}}
}}
"@

$startContainerRestPayload = @"
{{                 
   "PortBindings":{{ "{0}/tcp": [{{ "HostPort": "{1}" }}] }}  
}}
"@


# HELPER FUNCTIONS
function Validate-Port([int] $port )
{

    if ($port -lt 0 -or $port -gt 65535) 
    {
        throw "Port $port is Invalid. The valid port range is [0,65535]"
    }
}


function Parse-PortBinding
{	    
	if( $PortBindings )
	{
	    $PortBindings = $PortBindings.Trim();
        $ports = $PortBindings.Split(':');

        if( $ports.Count -ne 2 )
        {
            throw "Port Bindings argument is not valid.  Valid port number format is 'hostport:containerport'."
        }                
        elseif( $ports[1].Trim().Equals("") )
        {
            throw "Port Bindings argument is not valid. Container port should not be empty."
        }

        Write-Host ("Host Port: {0}, Container Port: {1}" -f $ports[0], $ports[1])

        Validate-Port -port $ports[0]
        Validate-Port -port $ports[1]

        $Global:hostPort = $ports[0].Trim()
        $Global:containerPort = $ports[1].Trim()          
	}
}

function Get-Repository
{
    if( $Tag )
    {
        $repository = ("$($Repository.Trim()):{0}" -f $Tag.Trim())
    }

    return $repository
}


function Get-CreateImageRestUrl
{
    $Repository = Get-Repository
    return ($createImageRestUrl -f $Repository)
}


function Get-StartContainerRestUrl($id)
{
    return ($startContainerRestUrl -f $id)
}


function Get-CreateContainerRestPayload
{
    $repository = Get-Repository       

    if( $Global:containerPort )
    {
        $exposedPortsPayload = $Global:exposedPorts -f $Global:containerPort
    }        

    return $createContainerRestPayload -f $repository, $exposedPortsPayload 
}


function Get-StartContainerRestPayload
{          
    if( $Global:hostPort )
    {
        $payload = ($startContainerRestPayload -f $Global:containerPort, $Global:hostPort)        
    }
    else
    {
        $payload = '{ "PublishAllPorts": true }'
    }
    
    return $payload
}


function Create-Image()
{       
    Write-Host ("Creating the image '{0}'" -f $Repository)

    $uri = Get-CreateImageRestUrl
    $response = Invoke-RestMethod -Method Post -Uri $uri -Body "" -ContentType $jsonContentType
    
    return $response
}


function Create-Container()
{
    Write-Host ("Creating the container '{0}'" -f $ContainerName)

    $payload = Get-CreateContainerRestPayload

	try
	{
		$response = Invoke-RestMethod -Method Post -Uri $createContainerRestUrl.Trim() -Body $payload -ContentType $jsonContentType
	}
	catch
	{  		
        $errorCode = [int]$_.Exception.Response.StatusCode		

		# If the status code is 404, it means the image doesn't exist		
        if( $errorCode -eq $notFoundErrorCode )
		{
            Write-Host ("Image '{0}' doesn't exists" -f $Repository)			            
            $global:isImageExists = $false;
		}
        # If the status code is 409, it means a container with the same name already exists
        elseif( $errorCode -eq $conflictErrorCode )
        {
            # Delete the container if it already exists
            Write-Host ("A container '{0}' already exists" -f $ContainerName)
	        Delete-Container -name $ContainerName

            # Retry the container creation
            $response = Invoke-RestMethod -Method Post -Uri $createContainerRestUrl.Trim() -Body $payload -ContentType $jsonContentType
        }
		else
		{ 
			Write-Host ("Exception Occurred while creating the container: {0}" -f $_.Exception.Message)          
			throw $_
		}        
	}
    
    return $response      
}


function Start-Container($id)
{
    Write-Host ("Starting the container '{0}'" -f $ContainerName)

    $uri = ($startContainerRestUrl -f $id)
    $payload = Get-StartContainerRestPayload
    $response = Invoke-RestMethod -Method Post -Uri $uri -Body $payload -ContentType $jsonContentType

    return $response
}


function Delete-Container($name)
{
    Write-Host ("Deleting the container '{0}'" -f $ContainerName)
    $uri = ($deleteContainerRestUrl -f $name)    

	try
	{
		Invoke-RestMethod -Method Delete -Uri $uri
	}   
	catch
	{
        $errorCode = [int]$_.Exception.Response.StatusCode		

		# If the status code is 404, it means container doesn't exist
		if( -not $errorCode -eq $notFoundErrorCode )		
		{ 
			Write-Host ("Exception Occurred while deleting the container: {0}" -f $_.Exception.Message)          
			throw $_
		}            
	}
}


# TASK LOGIC
try
{    
    # Validate the port binding
	Parse-PortBinding
        
    # Create the container		
    $result = Create-Container
    
	# Pull the image if it doesn't exists and retry the container creation
    if( -not $global:isImageExists )
    {
        Write-Host ("Image '{0}' doesn't exists on the host, pulling it from the registry" -f $Repository)
        Create-Image 
        $result = Create-Container        
    }

    Write-Host ("Container '{0}' created successfully with ID: {1}" -f $ContainerName, $result.Id)

	# Start the container    
    Start-Container -id $result.Id
    Write-Host ("Container {0} started successfully" -f $result.Id)
}
catch
{
    Write-Host ("Exception Occurred while deploying: {0}" -f $_.Exception.Message)    
    throw $_
}

Write-Host "Leaving script Docker-Deployment.ps1"