import requests
import re
import sys
import time
import logging
import os

print('Number of arguments:', len(sys.argv), 'arguments.')
print('Argument List:', str(sys.argv))

f = """<build>
            <triggeringOptions rebuildAllDependencies="true" />
            <buildType id=\"""" + sys.argv[2] + """\"/>
        </build>"""

if len(sys.argv) > 1:
    f = """<build>
            <triggeringOptions rebuildAllDependencies="true" />
            <buildType id=\"""" + sys.argv[2] + """\"/>
            <properties>
                <property name="reverse.dep.*.shelveset_name" value=\"""" + sys.argv[3] + """\"/>
            </properties>
        </build>"""

print("Queuing TeamCity build...")
r = requests.post(sys.argv[1] + 'httpAuth/app/rest/buildQueue',
                  headers={'Content-Type': 'application/xml'},
                  data=f,
                  auth=(sys.argv[4], sys.argv[5]))

print("Response:")
print(r.text)

b_info = re.search("build id..(\d+).*?webUrl.\"(.*?)\"", r.text)
buildId = b_info.group(1)
buildURL = b_info.group(2)

print("Build queued. TeamCity url: " + buildURL)
markdownfile = sys.argv[6] + '\TeamCityBuild.md' 
if os.path.isfile(markdownfile):
    os.remove(markdownfile)
f = open(markdownfile, 'ab+')
f.write('[' + buildURL + '](' + buildURL + ')')
f.close()

secs_timeout_btw_reqs = 5

while 1:
    print("Querying build state...")
    info = requests.get(sys.argv[1] + 'httpAuth/app/rest/buildQueue/id:' + buildId,
                        auth=(sys.argv[4], sys.argv[5]))

    state = re.search("state..([a-zA-Z]+)", info.text).group(1)
    if state != "finished":
        print("state == " + state + ". Will retry request in " + str(secs_timeout_btw_reqs) + " secs...")
    else:
        print("Querying build status...")
        status = re.search("status..([a-zA-Z]+)", info.text).group(1)
        if status == "SUCCESS":
            print("status == SUCCESS. Exiting with 0")
            sys.exit(0)
        else:
            print("status == " + status + ". Exiting with 1")
            sys.exit(1)
    time.sleep(secs_timeout_btw_reqs)



