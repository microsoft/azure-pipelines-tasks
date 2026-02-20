// Test constants and sample data for MavenAuthenticate L0 tests

export const TestConstants = {
    // Feed configurations
    feeds: {
        feedName1: "feedName1",
        feedName2: "feedName2",
        otherFeedName: "otherFeedName",
        invalidFeedName: "invalid-feed-name"
    },

    // Service connection configurations
    serviceConnections: {
        tokenBased: {
            id: "tokenBased",
            username: "AzureDevOps",
            token: "--token--"
        },
        usernamePassword: {
            id: "usernamePasswordBased",
            username: "--testUserName--",
            password: "--testPassword--"
        },
        privateKey: {
            id: "privateKeyBased",
            privateKey: "--privateKey--",
            passphrase: "--passphrase--"
        }
    },

    // WIF configurations
    wif: {
        serviceConnectionName: "TestWifConnection",
        token: "federated_test_token_12345",
        feedNames: ["feedName1", "feedName2"]
    },

    // Sample settings.xml content
    sampleSettingsXml: {
        empty: `<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0
                              http://maven.apache.org/xsd/settings-1.0.0.xsd">
</settings>`,

        withOtherFeed: `<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0
                              http://maven.apache.org/xsd/settings-1.0.0.xsd">
  <servers>
    <server>
      <id>otherFeedName</id>
      <username>otherUser</username>
      <password>otherPassword</password>
    </server>
  </servers>
</settings>`,

        withFeedName1: `<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0
                              http://maven.apache.org/xsd/settings-1.0.0.xsd">
  <servers>
    <server>
      <id>feedName1</id>
      <username>TestUser</username>
      <password>token</password>
    </server>
  </servers>
</settings>`
    },

    // System tokens
    systemToken: "test_system_access_token_12345",

    // Regex patterns for validation
    patterns: {
        servers: /<servers>/mig,
        server: /<server>/mig,
        feedName1Id: /<id>feedName1<\/id>/gi,
        otherFeedNameId: /<id>otherFeedName<\/id>/gi,
        usernameTag: /<username>/gi,
        passwordTag: /<password>/gi
    }
};
