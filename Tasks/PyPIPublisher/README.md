# PyPI Publisher

### Overview

This task can be used for publishing python packages to PyPI directly. 

When publishing a new package, user under generic endpoint will be assigned as owner of the package. 
For updating existing packages, user should have owner/maintainer role for the package. 

### Parameters for PyPI publisher task:

- **Python package path :** This is a Required field. Provide path of python package directory which is to be published. Setup file with the name setup.py should be present in this directory. 

- **PyPI connection :** This is a Required field. Select a generic endpoint where PyPI user and server details are present. 
To create a new generic service endpoint, under your VSTS project, go to Settings -> Services -> New Service Endpoint -> Generic.
Connection Name – Use a friendly connection name of your choice
Server URL – PyPI package server (for example: https://upload.pypi.org/legacy/)
User Name – PyPI registered username
Password – password for your PyPI account
