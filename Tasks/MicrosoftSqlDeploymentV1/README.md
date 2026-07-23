# Microsoft SQL Deployment Task

Cross-platform SQL Server, Azure SQL Database, and Azure SQL Managed Instance deployment task for Azure Pipelines.

## Features

- **Multiple Deployment Types**:
  - DACPAC deployment
  - SQL script execution
  - SQL project build and deploy
  - Inline SQL execution
  - Generate deployment scripts and reports

- **Cross-Platform Support**:
  - Windows agents
  - Linux agents
  - macOS agents (future)

- **Flexible Authentication**:
  - SQL Server Authentication
  - Active Directory Password
  - Active Directory Integrated
  - Service Principal (Azure only)

- **Automatic Firewall Management**:
  - Auto-detect agent IP address
  - Temporary firewall rule creation
  - Automatic cleanup after deployment

## Usage

### Basic DACPAC Deployment

```yaml
- task: MicrosoftSqlDeployment@1
  inputs:
    ConnectionType: 'ConnectionString'
    ConnectionString: 'Server=$(SqlServer);Database=$(DatabaseName);User Id=$(SqlUser);Password=$(SqlPassword)'
    DeploymentAction: 'Publish'
    DacpacFile: '$(Build.ArtifactStagingDirectory)/**/*.dacpac'
```

### SQL Script Execution

```yaml
- task: MicrosoftSqlDeployment@1
  inputs:
    ConnectionType: 'ConnectionString'
    ConnectionString: 'Server=$(SqlServer);Database=$(DatabaseName);Authentication=Active Directory Password;User Id=$(AadUser);Password=$(AadPassword)'
    DeploymentAction: 'SqlScript'
    SqlFile: '$(System.DefaultWorkingDirectory)/scripts/migration.sql'
```

### SQL Project Build and Deploy

```yaml
- task: MicrosoftSqlDeployment@1
  inputs:
    ConnectionType: 'AzureServiceConnection'
    ConnectedServiceNameARM: 'MyAzureSubscription'
    ServerName: 'myserver.database.windows.net'
    DatabaseName: 'MyDatabase'
    AuthenticationType: 'servicePrincipal'
    DeploymentAction: 'SqlProject'
    SqlProjectFile: '$(Build.SourcesDirectory)/database/MyDb.sqlproj'
    BuildArguments: '--configuration Release'
```

## Development Status

­čÜž **Work in Progress** - Foundation phase
- Ôťů Project structure created
- Ôťů TypeScript configuration
- Ôťů Task definition with all inputs
- ÔĆ│ Core implementation in progress
- ÔĆ│ Testing framework setup
- ÔĆ│ Documentation

## Contributing

This task follows the established patterns in the azure-pipelines-tasks repository.

## License

MIT
