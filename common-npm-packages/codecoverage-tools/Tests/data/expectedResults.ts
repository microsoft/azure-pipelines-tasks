import * as os from "os";

export const jacocoGradleSingleModule = `
allprojects {
    repositories {
        mavenCentral()
    }

    apply plugin: 'jacoco'
}

def jacocoExcludes = ['**/R.class','**/R$.class']
def jacocoIncludes = ['**/*$ViewInjector.class','**/*$ViewBinder.class']

jacocoTestReport {
    doFirst {
        fileCollectionAssign fileTree(dir: "some/folder/with/classes").exclude(jacocoExcludes).include(jacocoIncludes)
    }

    reports {
        html.enabled = true
        xml.enabled = true
        xml.destination file("report/dir/summary.xml")
        html.destination file("report/dir")
    }
}

test {
    finalizedBy jacocoTestReport
    jacoco {
        destinationFile = file("report/dir/jacoco.exec")
    }
}`;

export const jacocoGradleMultiModule = `
allprojects {
    repositories {
        mavenCentral()
    }

    apply plugin: 'jacoco'
}

def jacocoExcludes = ['**/R.class','**/R$.class']
def jacocoIncludes = ['**/*$ViewInjector.class','**/*$ViewBinder.class']

subprojects {
    jacocoTestReport {
        doFirst {
            fileCollectionAssign fileTree(dir: "some/folder/with/classes").exclude(jacocoExcludes).include(jacocoIncludes)
        }

        reports {
            html.enabled = true
            html.destination file("\${buildDir}/jacocoHtml")
            xml.enabled = true
            xml.destination file("\${buildDir}/summary.xml")
        }
    }
    test {
        jacoco {
            destinationFile = file("report/dir/jacoco.exec")
        }
    }
}

task jacocoRootReport(type: org.gradle.testing.jacoco.tasks.JacocoReport) {
    dependsOn = subprojects.test
    fileCollectionAssign files(subprojects.jacocoTestReport.executionData)
    fileCollectionAssign files(subprojects.sourceSets.main.allSource.srcDirs)
    fileCollectionAssign files()

    doFirst {
        subprojects.each {
            if (new File("\${it.sourceSets.main.output.classesDirs}").exists()) {
                logger.info("Class directory exists in sub project: \${it.name}")
                logger.info("Adding class files \${it.sourceSets.main.output.classesDirs}")
                classDirectories += fileTree(dir: "\${it.sourceSets.main.output.classesDirs}", includes: jacocoIncludes, excludes: jacocoExcludes)
            } else {
                logger.error("Class directory does not exist in sub project: \${it.name}")
            }
        }
    }

    reports {
        html.enabled = true
        xml.enabled = true
        xml.destination file("report/dir/summary.xml")
        html.destination file("report/dir/")
    }
}`;

export const coberturaGradleSingleModule = `
allprojects {
    repositories {
        mavenCentral()
    }
    apply plugin: 'net.saliman.cobertura'

    dependencies {
        testCompile 'org.slf4j:slf4j-api:1.7.12'
    }

    cobertura.coverageIncludes = ['**/*$ViewInjector.class','**/*$ViewBinder.class']
    cobertura.coverageExcludes = ['**/R.class','**/R$.class']
}

cobertura {
    coverageDirs = ["some/folder/with/classes"]
    coverageSourceDirs = source/dir
    coverageReportDir = new File('report/dir')
    coverageFormats = ['xml', 'html']
}`;

export const coberturaGradleSingleModuleWithNotSpecifiedSourceDir = `
allprojects {
    repositories {
        mavenCentral()
    }
    apply plugin: 'net.saliman.cobertura'

    dependencies {
        testCompile 'org.slf4j:slf4j-api:1.7.12'
    }

    cobertura.coverageIncludes = ['**/*$ViewInjector.class','**/*$ViewBinder.class']
    cobertura.coverageExcludes = ['**/R.class','**/R$.class']
}

cobertura {
    coverageDirs = ["some/folder/with/classes"]
    coverageSourceDirs = project.sourceSets.main.java.srcDirs
    coverageReportDir = new File('report/dir')
    coverageFormats = ['xml', 'html']
}`;

export const coberturaGradleSingleModuleWithNotSpecifiedClassDir = `
allprojects {
    repositories {
        mavenCentral()
    }
    apply plugin: 'net.saliman.cobertura'

    dependencies {
        testCompile 'org.slf4j:slf4j-api:1.7.12'
    }

    cobertura.coverageIncludes = ['**/*$ViewInjector.class','**/*$ViewBinder.class']
    cobertura.coverageExcludes = ['**/R.class','**/R$.class']
}

cobertura {
    coverageDirs = ["\${project.sourceSets.main.output.classesDirs}"]
    coverageSourceDirs = source/dir
    coverageReportDir = new File('report/dir')
    coverageFormats = ['xml', 'html']
}`;

export const coberturaGradleMultiModule = `
allprojects {
    repositories {
        mavenCentral()
    }
    apply plugin: 'net.saliman.cobertura'

    dependencies {
        testCompile 'org.slf4j:slf4j-api:1.7.12'
    }

    cobertura.coverageIncludes = ['**/*$ViewInjector.class','**/*$ViewBinder.class']
    cobertura.coverageExcludes = ['**/R.class','**/R$.class']
}

test {
    dependsOn = subprojects.test
}

cobertura {
    coverageSourceDirs = []
        coverageDirs = ["some/folder/with/classes"]
    coverageDirs = ["source/dir"]
    coverageFormats = [ 'xml', 'html' ]
    coverageMergeDatafiles = subprojects.collect { new File(it.projectDir, '/build/cobertura/cobertura.ser') }
    coverageReportDir = new File('report/dir')
}`;

export const coberturaGradleMultiModuleWithNotSpecifiedSourceDir = `
allprojects {
    repositories {
        mavenCentral()
    }
    apply plugin: 'net.saliman.cobertura'

    dependencies {
        testCompile 'org.slf4j:slf4j-api:1.7.12'
    }

    cobertura.coverageIncludes = ['**/*$ViewInjector.class','**/*$ViewBinder.class']
    cobertura.coverageExcludes = ['**/R.class','**/R$.class']
}

test {
    dependsOn = subprojects.test
}

cobertura {
    coverageSourceDirs = []
        coverageDirs = ["some/folder/with/classes"]
    rootProject.subprojects.each {
        coverageSourceDirs += it.sourceSets.main.java.srcDirs
    }
    coverageFormats = [ 'xml', 'html' ]
    coverageMergeDatafiles = subprojects.collect { new File(it.projectDir, '/build/cobertura/cobertura.ser') }
    coverageReportDir = new File('report/dir')
}`;

export const coberturaGradleMultiModuleWithNotSpecifiedClassDir = `
allprojects {
    repositories {
        mavenCentral()
    }
    apply plugin: 'net.saliman.cobertura'

    dependencies {
        testCompile 'org.slf4j:slf4j-api:1.7.12'
    }

    cobertura.coverageIncludes = ['**/*$ViewInjector.class','**/*$ViewBinder.class']
    cobertura.coverageExcludes = ['**/R.class','**/R$.class']
}

test {
    dependsOn = subprojects.test
}

cobertura {
    coverageSourceDirs = []
    rootProject.subprojects.each {
        coverageDirs << file("\${it.sourceSets.main.output.classesDirs}")
    }
    coverageDirs = ["source/dir"]
    coverageFormats = [ 'xml', 'html' ]
    coverageMergeDatafiles = subprojects.collect { new File(it.projectDir, '/build/cobertura/cobertura.ser') }
    coverageReportDir = new File('report/dir')
}`;

export const jacocoMavenSingleProject = {
    "groupId": "org.jacoco",
    "artifactId": "jacoco-maven-plugin",
    "version": "0.8.7",
    "configuration": {
        "destFile": "report\\dir\\jacoco.exec",
        "outputDirectory": "report/dir",
        "dataFile": "report\\dir\\jacoco.exec",
        "includes": [{
            "include": [
                '**/*$ViewInjector.class',
                '**/*$ViewBinder.class'
            ],
        }],
        "excludes": [{
            "exclude": [
                '**/R.class',
                '**/R$.class'
            ]
        }]
    },
    "executions": {
        "execution": [
            {
                "configuration":
                {
                    "includes": [{
                        "include": "**/*",
                    }]
                },
                "id": "default-prepare-agent-vsts",
                "goals": { "goal": "prepare-agent" }
            },
            {
                "id": "default-report-vsts",
                "goals": { "goal": "report" },
                "phase": "test"
            }
        ]
    }
};

export const jacocoMavenMultiProject = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>VstsReport</groupId>
  <artifactId>VstsReport</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <packaging>pom</packaging>
  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-antrun-plugin</artifactId>
        <version>1.8</version>
        <executions>
          <execution>
            <phase>post-integration-test</phase>
            <goals>
              <goal>run</goal>
            </goals>
            <configuration>
              <target>
                <echo message="Generating JaCoCo Reports" />
                <taskdef name="report" classname="org.jacoco.ant.ReportTask">
                  <classpath path="{basedir}/target/jacoco-jars/org.jacoco.ant.jar" />
                </taskdef>
                <report>
                  <executiondata>
                    <file file="report\\dir\\jacoco.exec" />
                  </executiondata>
                  <structure name="Jacoco report">
                    <classfiles>
                      <fileset dir="some/folder1/with/classes" includes="'**/*$ViewInjector.class','**/*$ViewBinder.class'" excludes="'**/R.class','**/R$.class'" />${os.EOL}<fileset dir="some/folder2/with/classes" includes="'**/*$ViewInjector.class','**/*$ViewBinder.class'" excludes="'**/R.class','**/R$.class'" />${os.EOL}
                    </classfiles>
                    <sourcefiles encoding="UTF-8">
                      <fileset dir="source/dir1" />${os.EOL}<fileset dir="source/dir2" />${os.EOL}
                    </sourcefiles>
                  </structure>
                  <html destdir="report/dir" />
                  <xml destfile="report/dir\\jacoco.xml" />
                  <csv destfile="report/dir\\report.csv" />
                </report>
              </target>
            </configuration>
          </execution>
        </executions>
        <dependencies>
          <dependency>
            <groupId>org.jacoco</groupId>
            <artifactId>org.jacoco.ant</artifactId>
            <version>0.8.7</version>
          </dependency>
        </dependencies>
      </plugin>
    </plugins>
  </build>
</project>
    `

export const coberturaMavenEnableConfiguration = `
    <plugin>
        <groupId>org.codehaus.mojo</groupId>
        <artifactId>cobertura-maven-plugin</artifactId>
        <version>2.7</version>
        <configuration>
          <formats>
            <format>xml</format>
            <format>html</format>
          </formats>
          <instrumentation>
            <includes><include>'**/*$ViewInjector.class'</include>${os.EOL}<include>'**/*$ViewBinder.class'</include>${os.EOL}</includes>
            <excludes><exclude>'**/R.class'</exclude>${os.EOL}<exclude>'**/R$.class'</exclude>${os.EOL}</excludes>
          </instrumentation>
          <aggregate>aggregateFake</aggregate>
        </configuration>
        <executions>
          <execution>
            <id>package-9af52907-6506-4b87-b16a-9883edee41bc</id>
            <goals>
              <goal>cobertura</goal>
            </goals>
            <phase>package</phase>
          </execution>
        </executions>
    </plugin>
  `;

export const jacocoAntReportConfiguration = `<?xml version="1.0"?>
<project name="JacocoReport">
    <target name="CodeCoverage_9064e1d0">
        <jacoco:report xmlns:jacoco="antlib:org.jacoco.ant">
            <executiondata>
                <file file="report\\dir\\jacoco.exec"/>
            </executiondata>
            <structure name="Jacoco report">
                <classfiles>some/folder/with/classes</classfiles>
                <sourcefiles>source/dir</sourcefiles>
            </structure>
            <html destdir="report/dir" />
            <csv destfile="report/dir\\summary.csv" />
            <xml destfile="report/dir\\summary.xml" />
        </jacoco:report>
    </target>
</project>
    `

export const jacocoAntCoverageEnableConfiguration = {
    $:
    {
        "destfile": "report\\dir\\jacoco.exec",
        "xmlns:jacoco": "antlib:org.jacoco.ant"
    }
};

export const coberturaAntReportConfiguration = `<?xml version="1.0"?>
<project name="CoberturaReport">
  <property environment="env" />
  <path id="cobertura-classpath" description="classpath for instrumenting classes">
    <fileset dir="\${env.COBERTURA_HOME}">
      <include name="cobertura*.jar" />
      <include name="**/lib/**/*.jar" />
    </fileset>
  </path>
  <taskdef classpathref="cobertura-classpath" resource="tasks.properties" />
  <target name="CodeCoverage_9064e1d0">
    <cobertura-report format="html" destdir="report/dir" datafile="report/dir\\cobertura.ser" srcdir="source/dir" />
    <cobertura-report format="xml" destdir="report/dir" datafile="report/dir\\cobertura.ser" srcdir="source/dir" />
  </target>
</project>
    `;

export const coberturaAntInstrumentedClassesConfiguration = `
<cobertura-instrument todir="base\\dir\\InstrumentedClasses" datafile="report\\dir\\cobertura.ser">
    some/folder/with/classes
</cobertura-instrument>
  `;

export const coberturaAntPropertiesConfiguration = `
        <sysproperty key="net.sourceforge.cobertura.datafile" file="report\\dir\\cobertura.ser" />
        <classpath location="base\\dir\\InstrumentedClasses" />
`;

export const emptyFilters = {
    includeFilter: "",
    excludeFilter: ""
}

export const correctFilters = {
    includeFilter: ":**/R:**/R$:**/BuildConfig",
    excludeFilter: ":**/*$ViewInjector:**/*$ViewBinder:**/Manifest"
}

export const sortedStringArray = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];

export const emptyObjectWithAddedProperty = {
    someProperty: 108
}

export const objectWithAddedProperty = {
    firstProperty: "First Value",
    secondProperty: "Second Value",
    someProperty: 108
}

export const objectWithAddedPropertyIntoArray = {
    firstProperty: "First Value",
    secondProperty: "Second Value",
    someProperty: [42, 108]
}

export const arrayWithAddedProperty = [
    {
        firstProperty: "First Value",
        secondProperty: "Second Value",
    },
    {
        firstProperty: "First Value",
    },
    {
        someProperty: 108
    }
]

export const arrayWithAppendedProperty = [
    {
        firstProperty: "First Value"
    },
    {
        firstProperty: "First Value",
        someProperty: [42, 108]
    }
]