import httplib
import os
import sys
import xml.etree.ElementTree as ET
from email.utils import formatdate
from datetime import datetime
from time import mktime

if(len(sys.argv) != 5):
    raise Exception('4 arguments expected. {0} arguments received'.format(len(sys.argv)))

storage_account_name = sys.argv[1]
container_name = sys.argv[2]
sas_token = sys.argv[3]
path = sys.argv[4]

method = httplib.HTTPSConnection
conn = method("{0}.blob.core.windows.net".format(storage_account_name))
address = "/{0}".format( container_name)
address += "?{0}".format(sas_token)
address += "&restype=container&comp=list"
conn.request('GET', address)
response = conn.getresponse()
if(response.status == 200):
    blobs_list = response.read()
else:
    raise Exception("Error fetching list of the blobs in the container")

#utf-8 bom
if((ord(blobs_list[0]) == 239) and (ord(blobs_list[1]) == 187) and (ord(blobs_list[2]) == 191)):
    blobs_list = blobs_list[3:]
root = ET.fromstring(blobs_list)
if(path):
    if(not(os.path.isdir(path))):
        os.makedirs(path)
    os.chdir(path)
method = httplib.HTTPSConnection
url = root.attrib['ServiceEndpoint'][8:].strip('/')
fixed_address = '/{0}'.format(root.attrib['ContainerName'])
failed_downloads = []
for blob in root[0]:
    blob_name = blob[0].text
    address = '{0}/{1}'.format(fixed_address, blob_name)
    address += "?{0}".format(sas_token)
    conn = method(url)
    conn.request('GET', address)
    response = conn.getresponse()
    if(response.status == 200):
        blob_content = response.read()
        blob_path = os.path.dirname(blob_name)
        if(blob_path and not(os.path.isdir(blob_path))):
            os.makedirs(blob_path)
        with open(blob_name, 'wb') as f:
            f.write(blob_content)
            f.close()
    else:
        failed_downloads += [blob_name]
if(not(failed_downloads == [])):
    raise Exception("The following files could not be downloaded {0}".format(failed_downloads))

