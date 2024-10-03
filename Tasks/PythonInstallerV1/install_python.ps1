# Change directory to where the installer is located
Set-Location -Path "C:\path\to\your\installer"

# Run the installer in silent mode
Start-Process -FilePath "python-3.x.x.exe" -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1" -Wait

# Verify the installation
python --version
