[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Get-LocalizedString { $OFS = " " ; "$args" }
Register-Mock Get-TaskVariable

. $PSScriptRoot\..\..\..\Tasks\VsTest\Helpers.ps1

$cpuCount="1"
$runSettingFiles=@('<?xml version="1.0" encoding="utf-8"?>
<RunSettings>
</RunSettings>
',
'<?xml version="1.0" encoding="utf-8"?>
<RunSettings>
  <!-- Configurations that affect the Test Framework -->
  <RunConfiguration>

  </RunConfiguration>
  
  <TestRunParameters>
    <Parameter name="webAppUrl" value="http://localhost" />
  </TestRunParameters>

  <!-- Adapter Specific sections -->
  
  <!-- MSTest adapter -->
  <MSTest>
    <MapInconclusiveToFailed>True</MapInconclusiveToFailed>
    <CaptureTraceOutput>false</CaptureTraceOutput>
    <DeleteDeploymentDirectoryAfterTestRunIsComplete>False</DeleteDeploymentDirectoryAfterTestRunIsComplete>
    <DeploymentEnabled>False</DeploymentEnabled>
  </MSTest> 
</RunSettings>
',
'<?xml version="1.0" encoding="UTF-8"?>
<RunSettings>
    <DataCollectionRunSettings>
        <DataCollectors>
            <DataCollector uri="datacollector://Microsoft/CodeCoverage/2.0" assemblyQualifiedName="Microsoft.VisualStudio.Coverage.DynamicCoverageDataCollector, Microsoft.VisualStudio.TraceCollector, Version=14.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a" friendlyName="Code Coverage">
                <Configuration>
                    <CodeCoverage>
                        <CommunicationTimeout>30000</CommunicationTimeout>
                        <CollectFromChildProcesses>true</CollectFromChildProcesses>
                        <UseVerifiableInstrumentation>true</UseVerifiableInstrumentation>
                        <AllowLowIntegrityProcesses>true</AllowLowIntegrityProcesses>
                        <AllowedUsers />
                        <SymbolSearchPaths />
                        <ModulePaths>
                            <Exclude>
                                <ModulePath>.*CPPUnitTestFramework.*</ModulePath>
                            </Exclude>
                        </ModulePaths>
                        <CompanyNames>
                            <Exclude>
                                <CompanyName>.*microsoft.*</CompanyName>
                            </Exclude>
                        </CompanyNames>
                        <PublicKeyTokens>
                            <Exclude>
                                <PublicKeyToken>^B77A5C561934E089$</PublicKeyToken>
                                <PublicKeyToken>^B03F5F7F11D50A3A$</PublicKeyToken>
                                <PublicKeyToken>^31BF3856AD364E35$</PublicKeyToken>
                                <PublicKeyToken>^89845DCD8080CC91$</PublicKeyToken>
                                <PublicKeyToken>^71E9BCE111E9429C$</PublicKeyToken>
                                <PublicKeyToken>^8F50407C4E9E73B6$</PublicKeyToken>
                                <PublicKeyToken>^E361AF139669C375$</PublicKeyToken>
                            </Exclude>
                        </PublicKeyTokens>
                        <Sources>
                            <Exclude>
                                <Source>.*\\atlmfc\\.*</Source>
                                <Source>.*\\vctools\\.*</Source>
                                <Source>.*\\public\\sdk\\.*</Source>
                                <Source>.*\\microsoft sdks\\.*</Source>
                                <Source>.*\\vc\\include\\.*</Source>
                            </Exclude>
                        </Sources>
                        <Attributes>
                            <Exclude>
                                <Attribute>^System.Diagnostics.DebuggerHiddenAttribute$</Attribute>
                                <Attribute>^System.Diagnostics.DebuggerNonUserCodeAttribute$</Attribute>
                                <Attribute>^System.Runtime.CompilerServices.CompilerGeneratedAttribute$</Attribute>
                                <Attribute>^System.CodeDom.Compiler.GeneratedCodeAttribute$</Attribute>
                                <Attribute>^System.Diagnostics.CodeAnalysis.ExcludeFromCodeCoverageAttribute$</Attribute>
                            </Exclude>
                        </Attributes>
                        <Functions>
                            <Exclude>
                                <Function>^std::.*</Function>
                                <Function>^ATL::.*</Function>
                                <Function>^__.*</Function>
                                <Function>.*::__.*</Function>
                                <Function>^Microsoft::VisualStudio::CppCodeCoverageFramework::.*</Function>
                                <Function>^Microsoft::VisualStudio::CppUnitTestFramework::.*</Function>
                            </Exclude>
                        </Functions>
                    </CodeCoverage>
                </Configuration>
            </DataCollector>
        </DataCollectors>
    </DataCollectionRunSettings>
</RunSettings>
',
'<?xml version="1.0" encoding="UTF-8"?>
<RunSettings>
  <RunConfiguration>
    <ResultsDirectory>c:\</ResultsDirectory>
  </RunConfiguration>
  <DataCollectionRunSettings>
    <DataCollectors>
      <DataCollector uri="datacollector://Microsoft/CodeCoverage/2.0" assemblyQualifiedName="Microsoft.VisualStudio.Coverage.DynamicCoverageDataCollector, Microsoft.VisualStudio.TraceCollector, Version=11.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a" friendlyName="Code Coverage">
        <Configuration>
          <CodeCoverage>
            <CommunicationTimeout>30000</CommunicationTimeout>
            <CollectFromChildProcesses>true</CollectFromChildProcesses>
            <UseVerifiableInstrumentation>true</UseVerifiableInstrumentation>
            <AllowLowIntegrityProcesses>true</AllowLowIntegrityProcesses>
            <AllowedUsers />
            <SymbolSearchPaths />
            <ModulePaths>
              <Exclude>
                <ModulePath>.*CPPUnitTestFramework.*</ModulePath>
              </Exclude>
            </ModulePaths>
            <CompanyNames>
              <Exclude>
                <CompanyName>.*microsoft.*</CompanyName>
              </Exclude>
            </CompanyNames>
            <PublicKeyTokens>
              <Exclude>
                <PublicKeyToken>^B77A5C561934E089$</PublicKeyToken>
                <PublicKeyToken>^B03F5F7F11D50A3A$</PublicKeyToken>
                <PublicKeyToken>^31BF3856AD364E35$</PublicKeyToken>
                <PublicKeyToken>^89845DCD8080CC91$</PublicKeyToken>
                <PublicKeyToken>^71E9BCE111E9429C$</PublicKeyToken>
                <PublicKeyToken>^8F50407C4E9E73B6$</PublicKeyToken>
                <PublicKeyToken>^E361AF139669C375$</PublicKeyToken>
              </Exclude>
            </PublicKeyTokens>
            <Sources>
              <Exclude>
                <Source>.*\\atlmfc\\.*</Source>
                <Source>.*\\vctools\\.*</Source>
                <Source>.*\\public\\sdk\\.*</Source>
                <Source>.*\\microsoft sdks\\.*</Source>
                <Source>.*\\vc\\include\\.*</Source>
              </Exclude>
            </Sources>
            <Attributes>
              <Exclude>
                <Attribute>^System.Diagnostics.DebuggerHiddenAttribute$</Attribute>
                <Attribute>^System.Diagnostics.DebuggerNonUserCodeAttribute$</Attribute>
                <Attribute>^System.Runtime.CompilerServices.CompilerGeneratedAttribute$</Attribute>
                <Attribute>^System.CodeDom.Compiler.GeneratedCodeAttribute$</Attribute>
                <Attribute>^System.Diagnostics.CodeAnalysis.ExcludeFromCodeCoverageAttribute$</Attribute>
              </Exclude>
            </Attributes>
            <Functions>
              <Exclude>
                <Function>^std::.*</Function>
                <Function>^ATL::.*</Function>
                <Function>^__.*</Function>
                <Function>^Microsoft::VisualStudio::CppCodeCoverageFramework::.*</Function>
                <Function>^Microsoft::VisualStudio::CppUnitTestFramework::.*</Function>
              </Exclude>
            </Functions>
          </CodeCoverage>
        </Configuration>
      </DataCollector>
    </DataCollectors>
  </DataCollectionRunSettings>
</RunSettings>
',
'<?xml version="1.0" encoding="UTF-8"?>
<RunSettings>
	<DataCollectionRunSettings>
		<DataCollectors>
		  <DataCollector uri="datacollector://Microsoft/CodeCoverage/2.0" assemblyQualifiedName="Microsoft.VisualStudio.Coverage.DynamicCoverageDataCollector, Microsoft.VisualStudio.TraceCollector, Version=11.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a" friendlyName="Code Coverage">
			<Configuration>
			  <CodeCoverage>
				<CommunicationTimeout>30000</CommunicationTimeout>
				<CollectFromChildProcesses>true</CollectFromChildProcesses>
				<UseVerifiableInstrumentation>true</UseVerifiableInstrumentation>
				<AllowLowIntegrityProcesses>true</AllowLowIntegrityProcesses>
				<CollectAspDotNet>true</CollectAspDotNet>
          <SymbolSearchPaths />
				<ModulePaths>
					<Include>
						<ModulePath>.*</ModulePath>
					</Include>
				</ModulePaths>
				<CompanyNames>
				  <Exclude>
					<CompanyName>.*microsoft.*</CompanyName>
				  </Exclude>
				</CompanyNames>
				<PublicKeyTokens>
				  <Exclude>
					<PublicKeyToken>^B77A5C561934E089$</PublicKeyToken>
					<PublicKeyToken>^B03F5F7F11D50A3A$</PublicKeyToken>
					<PublicKeyToken>^31BF3856AD364E35$</PublicKeyToken>
					<PublicKeyToken>^89845DCD8080CC91$</PublicKeyToken>
					<PublicKeyToken>^71E9BCE111E9429C$</PublicKeyToken>
					<PublicKeyToken>^8F50407C4E9E73B6$</PublicKeyToken>
					<PublicKeyToken>^E361AF139669C375$</PublicKeyToken>
				  </Exclude>
				</PublicKeyTokens>
				<Sources>
				  <Exclude>
					<Source>.*\\atlmfc\\.*</Source>
					<Source>.*\\vctools\\.*</Source>
					<Source>.*\\public\\sdk\\.*</Source>
					<Source>.*\\microsoft sdks\\.*</Source>
					<Source>.*\\vc\\include\\.*</Source>
				  </Exclude>
				</Sources>
				<Attributes>
				  <Exclude>
					<Attribute>^System.Diagnostics.DebuggerHiddenAttribute$</Attribute>
					<Attribute>^System.Diagnostics.DebuggerNonUserCodeAttribute$</Attribute>
					<Attribute>^System.Runtime.CompilerServices.CompilerGeneratedAttribute$</Attribute>
					<Attribute>^System.CodeDom.Compiler.GeneratedCodeAttribute$</Attribute>
					<Attribute>^System.Diagnostics.CodeAnalysis.ExcludeFromCodeCoverageAttribute$</Attribute>
				  </Exclude>
				</Attributes>
				<Functions>
				  <Exclude>
					<Function>^std::.*</Function>
					<Function>^ATL::.*</Function>
					<Function>^__.*</Function>
					<Function>^Microsoft::VisualStudio::CppCodeCoverageFramework::.*</Function>
					<Function>^Microsoft::VisualStudio::CppUnitTestFramework::.*</Function>
				  </Exclude>
				</Functions>
			  </CodeCoverage>
			</Configuration>
		  </DataCollector>
		</DataCollectors>
	</DataCollectionRunSettings>
</RunSettings>
')

foreach ($runSettingsForParallel in $runSettingFiles)
{
  Assert-AreEqual $false $runSettingsForParallel.Contains("MaxCpuCount")
	$returnedFilePath = SetupRunSettingsFileForParallel "true" $runSettingsFilePath $cpuCount
	
	$fileExists = Test-Path $returnedFilePath
	Assert-AreEqual $true $fileExists
	
	$readRunSettingsFile=[System.Xml.XmlDocument](Get-Content $returnedFilePath)
	Assert-AreEqual $cpuCount $readRunSettingsFile.RunSettings.RunConfiguration.MaxCpuCount
	
	#cleanup
	if($fileExists){
		Remove-Item $returnedFilePath
	}
}

