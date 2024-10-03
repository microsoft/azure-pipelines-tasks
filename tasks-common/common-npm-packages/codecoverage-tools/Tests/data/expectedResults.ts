import * as os from 'os';
import * as path from 'path';

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
    'groupId': 'org.jacoco',
    'artifactId': 'jacoco-maven-plugin',
    'version': '0.8.11',
    'configuration': {
        'includes': [{
            'include': [
                '**/*$ViewInjector.class',
                '**/*$ViewBinder.class'
            ]
        }],
        'excludes': [{
            'exclude': [
                '**/R.class',
                '**/R$.class'
            ]
        }]
    },
    'executions': {
        'execution': [
            {
                'configuration':
                {
                    'includes': [{
                        'include': '**/*'
                    }]
                },
                'id': 'default-prepare-agent-vsts',
                'goals': { 'goal': 'prepare-agent' }
            },
            {
                'id': 'default-report-vsts',
                'goals': { 'goal': 'report' },
                'phase': 'test'
            }
        ]
    }
};

export const jacocoMavenMultiProject = `<?xml version="1.0" encoding="UTF-8"?>
        <project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
            <modelVersion>4.0.0</modelVersion>
            <groupId>some.group.plugins</groupId>
            <artifactId>report-artifact-id</artifactId>
            <version>1.0-SNAPSHOT</version>
            <packaging>pom</packaging>
            <modules><module name="module"></module></modules>
            <parentData></parentData>
            <build>
                <plugins>
                    <plugin>
                        <groupId>org.jacoco</groupId>
                        <artifactId>jacoco-maven-plugin</artifactId>
                        <version>0.8.11</version>
                        <executions>
                            <execution>
                                <id>jacoco-report-aggregate</id>
                                <phase>verify</phase>
                                <goals>
                                    <goal>report-aggregate</goal>
                                </goals>
                            </execution>
                        </executions>
                    </plugin>
                </plugins>
            </build>
        </project>`;

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
                <file file="report${path.sep}dir${path.sep}jacoco.exec"/>
            </executiondata>
            <structure name="Jacoco report">
                <classfiles>some/folder/with/classes</classfiles>
                <sourcefiles>source/dir</sourcefiles>
            </structure>
            <html destdir="report/dir" />
            <csv destfile="report/dir${path.sep}summary.csv" />
            <xml destfile="report/dir${path.sep}summary.xml" />
        </jacoco:report>
    </target>
</project>
    `;

export const jacocoAntCoverageEnableConfiguration = {
    $:
    {
        'destfile': `report${path.sep}dir${path.sep}jacoco.exec`,
        'xmlns:jacoco': 'antlib:org.jacoco.ant'
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
    <cobertura-report format="html" destdir="report/dir" datafile="report/dir${path.sep}cobertura.ser" srcdir="source/dir" />
    <cobertura-report format="xml" destdir="report/dir" datafile="report/dir${path.sep}cobertura.ser" srcdir="source/dir" />
  </target>
</project>
    `;

export const coberturaAntInstrumentedClassesConfiguration = `
<cobertura-instrument todir="base${path.sep}dir${path.sep}InstrumentedClasses" datafile="report${path.sep}dir${path.sep}cobertura.ser">
    some/folder/with/classes
</cobertura-instrument>
  `;

export const coberturaAntPropertiesConfiguration = `
        <sysproperty key="net.sourceforge.cobertura.datafile" file="report${path.sep}dir${path.sep}cobertura.ser" />
        <classpath location="base${path.sep}dir${path.sep}InstrumentedClasses" />
`;

export const sortedStringArray = ['a', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];

export const objectWithAddedProperty = {
    firstProperty: 'First Value',
    secondProperty: 'Second Value',
    someProperty: 108
};

export const objectWithAddedPropertyIntoArray = {
    firstProperty: 'First Value',
    secondProperty: 'Second Value',
    someProperty: [42, 108]
};

export const arrayWithAddedProperty = [
    {
        firstProperty: 'First Value',
        secondProperty: 'Second Value'
    },
    {
        firstProperty: 'First Value'
    },
    {
        someProperty: 108
    }
];

export const arrayWithAppendedProperty = [
    {
        firstProperty: 'First Value'
    },
    {
        firstProperty: 'First Value',
        someProperty: [42, 108]
    }
];