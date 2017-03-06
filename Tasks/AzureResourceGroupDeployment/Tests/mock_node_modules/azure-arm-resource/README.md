# Microsoft Azure SDK for Node.js - Resource Management

This project provides a Node.js package that makes it easy to manage Azure resources. Right now it supports:
- **Node.js version: 4.x.x or higher**
- **API version: 2016-02-01**

## Features

 - TODO

## How to Install

```bash
npm install azure-arm-resource
```

## How to Use

### Authentication, client creation and listing resources as an example

 ```javascript
 var msRestAzure = require('ms-rest-azure');
 var resourceManagement = require("azure-arm-resource");
 
 // Interactive Login
 msRestAzure.interactiveLogin(function(err, credentials) {
  var client = new resourceManagement.ResourceManagementClient(credentials, 'your-subscription-id');
  client.resources.list(function(err, result) {
    if (err) console.log(err);
    console.log(result);
  });
 });
 ```

## Creating a Resource Group

```javascript
var util = require('util');
var groupParameters = {
  location: 'West US',
  tags: {
    tag1: 'val1',
    tag2: 'val2'
  }
};
var groupName = 'testGroup1';
client.resourceGroups.createOrUpdate(groupName, groupParameters, function (err, result, request, response) {
  if (err) {
    console.log(err);
    /*err has reference to the actual request and response, so you can see what was sent and received on the wire.
      The structure of err looks like this:
      err: {
        code: 'Error Code',
        message: 'Error Message',
        body: 'The response body if any',
        request: reference to a stripped version of http request
        response: reference to a stripped version of the response
      }
    */
  } else {
    console.log('result is: ' + util.inspect(result, {depth: null}));
  }
});
```

## Create a Generic Resource in a Resource Group

```javascript
var groupName = 'testGroup1';
var resourceName = 'autorestsite102';
var params = { 'location': 'West US', 'properties' : { 'SiteMode': 'Limited', 'ComputeMode': 'Shared' }, 'Name': resourceName };
var resourceType = 'sites';
var parentResourcePath = '';
var resourceProviderNamespace = 'Microsoft.Web';
var apiVersion = '2014-04-01';
client.resources.createOrUpdate(groupName, resourceProviderNamespace, parentResourcePath, 
  resourceType, resourceName , apiVersion, params, function (err, result, request, response) {
  if (err) {
    console.log(err);
  } else {
    console.log(result);
  }
});
```

## Get a Generic Resource in a Resource Group

```javascript
var groupName = 'testGroup1';
var resourceName = 'autorestsite102';
var resourceType = 'sites';
var parentResourcePath = '';
var resourceProviderNamespace = 'Microsoft.Web';
var apiVersion = '2014-04-01';
client.resources.get(groupName, resourceProviderNamespace, parentResourcePath, 
  resourceType, resourceName, apiVersion, function (err, result, request, response) {
  if (err) {
    console.log(err);
  } else {
    console.log(result);
  }
});
```

## Listing all resources in your subscription

```javascript
client.resources.list(function (err, result, request, response) {
  if (err) {
    console.log(err);
  } else {
    console.log(result);
  }
});
```

## Deleting a Generic Resource in a Resource Group

```javascript
var groupName = 'testGroup1';
var resourceName = 'autorestsite102';
var resourceType = 'sites';
var parentResourcePath = '';
var resourceProviderNamespace = 'Microsoft.Web';
var apiVersion = '2014-04-01';
client.resources.deleteMethod(groupName, resourceProviderNamespace, parentResourcePath, 
  resourceType, resourceName, apiVersion, function (err, result, request, response) {
  if (err) {
    console.log(err);
  } else {
    console.log(result);
  }
});
```

## Deleting the Resource Group

```javascript
var groupName = 'testGroup1';
client.resourceGroups.deleteMethod(groupName, function (err, result, request, response) {
  if (err) {
    console.log(err);
  } else {
    console.log(result);
  }
});
```
Please take a look at the tests over [here](https://github.com/Azure/azure-sdk-for-node/tree/autorest/test/services/resourceManagement) for more examples.

## Related projects

- [Microsoft Azure SDK for Node.js - All-up](https://github.com/Azure/azure-sdk-for-node)
