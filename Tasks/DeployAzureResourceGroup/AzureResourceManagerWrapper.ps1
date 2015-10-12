function Get-AzureRMResource
{
    param([string]$ResourceType,
          [string]$ResourceGroupName,
          [string]$ErrorAction)

    Write-Verbose -Verbose "Inside Get-AzureRMResource"
    Get-AzureResource -ResourceType $ResourceType -ResourceGroupName $ResourceGroupName -ErrorAction $ErrorAction
}

function Get-AzureRMResourceGroup
{
    param([string]$ResourceGroupName,
          [string]$ErrorAction)
    Write-Verbose -Verbose "Inside Get-AzureRMResourceGroup"
    Get-AzureResourceGroup -ResourceGroupName $ResourceGroupName -ErrorAction $ErrorAction
}

function Get-AzureRMVM
{
    param([string]$Name,
          [string]$ResourceGroupName,
          [string]$ErrorAction)

    Write-Verbose -Verbose "Inside Get-AzureRMVM"
    Get-AzureVM -Name $Name -ResourceGroupName $ResourceGroupName -Status -Verbose -ErrorAction $ErrorAction
}

function New-AzureRMResourceGroup
{
    param([string]$Name,
          [string]$Location,
          [string]$ErrorAction)

    Write-Verbose -Verbose "Inside New-AzureRMResourceGroup"
    New-AzureResourceGroup -Name $Name -Location $Location -Verbose -ErrorAction $ErrorAction
}

function Remove-AzureRMResourceGroup
{
    param([string]$Name,
          [string]$ResourceType,
          [string]$ErrorAction)

    Write-Verbose -Verbose "Inside Remove-AzureRMResourceGroup"
    Remove-AzureResourceGroup -Name $Name -Force -ErrorAction $ErrorAction -Verbose
}

function Remove-AzureRMVM
{
    param([string]$Name,
          [string]$ResourceGroupName,
          [string]$ErrorAction)

    Write-Verbose -Verbose "Inside Remove-AzureRMVM"
    $response = Remove-AzureVM  -Name $Name -ResourceGroupName $ResourceGroupName -Force -ErrorAction $ErrorAction -Verbose

    $response
}

function Start-AzureRMVM
{
    param([string]$Name,
          [string]$ResourceGroupName,
          [string]$ErrorAction)

    Write-Verbose -Verbose "Inside Start-AzureRMVM"
    $response = Start-AzureVM  -Name $Name -ResourceGroupName $ResourceGroupName -ErrorAction $ErrorAction -Verbose

    $response
}

function Stop-AzureRMVM
{
    param([string]$Name,
          [string]$ResourceGroupName,
          [string]$ErrorAction)

    Write-Verbose -Verbose "Inside Stop-AzureRMVM"
    $response = Stop-azureVM -Name $Name -ResourceGroupName $ResourceGroupName -Force -ErrorAction $ErrorAction -Verbose

    $response
}