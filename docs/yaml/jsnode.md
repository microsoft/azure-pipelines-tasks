Refer to [https://github.com/Microsoft/vsts-agent/blob/master/docs/preview/yamlgettingstarted.md](https://github.com/Microsoft/vsts-agent/blob/master/docs/preview/yamlgettingstarted.md)

<!--
# jsnode

```yaml
my build job:
  language: jsnode

  # jsnode language plugin knows it's node that it installs and had the node installer
  # yaml definitions define
  nodejs:
    - 0.12.7
    - 4.3.2

  # if steps do not exist the nodejs lang plugin will npm install, npm test
  # you can specify
  steps:
    - npm install
    - gulp
    - gulp test


    # the jsnode language plugin knows if a gulpfile to inject a gulp task
    - src/gulpfile.js

    - gulp src/gulptest.js test
    - gulp test

```
-->
