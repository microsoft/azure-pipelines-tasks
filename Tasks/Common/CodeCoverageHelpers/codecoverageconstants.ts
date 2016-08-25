import * as path from 'path';
import * as util from './utilities';

// Enable Jacoco Code Coverage for Gradle builds using this props
export function jacocoGradleMultiModuleEnable(excludeFilter: string, includeFilter: string, classFileDirectory: string, reportDir: string) {
    return `
allprojects { apply plugin: 'jacoco' }

allprojects {
	repositories {
        mavenCentral()
    }
}

def jacocoExcludes = [${excludeFilter}]
def jacocoIncludes = [${includeFilter}]

subprojects {	
    jacocoTestReport {
		doFirst {
			classDirectories = fileTree(dir: "${classFileDirectory}").exclude(jacocoExcludes).include(jacocoIncludes)
		}
		
		reports {
			html.enabled = true
			html.destination "\${buildDir}/jacocoHtml/"
            xml.enabled = true    
	        xml.destination "\${buildDir}/summary.xml"
        }
    }
	test {
		jacoco {
			append = true
			destinationFile = file("${reportDir}/jacoco.exec")
		}
	}
}

task jacocoRootReport(type: org.gradle.testing.jacoco.tasks.JacocoReport) {
	dependsOn = subprojects.test
	executionData = files(subprojects.jacocoTestReport.executionData)
	sourceDirectories = files(subprojects.sourceSets.main.allSource.srcDirs)
	classDirectories = files()
	
	doFirst {
		subprojects.each {
			if (new File("\${it.sourceSets.main.output.classesDir}").exists()) {
				logger.info("Class directory exists in sub project: \${it.name}")
				logger.info("Adding class files \${it.sourceSets.main.output.classesDir}")
				classDirectories += fileTree(dir: "\${it.sourceSets.main.output.classesDir}", includes: jacocoIncludes, excludes: jacocoExcludes)
			} else {
				logger.error("Class directory does not exist in sub project: \${it.name}")
			}
		}
	}
	
	reports {
		html.enabled = true
        xml.enabled = true    
		xml.destination "${reportDir}/summary.xml"
		html.destination "${reportDir}/"
	}
}`;
}

export function jacocoGradleSingleModuleEnable(excludeFilter: string, includeFilter: string, classFileDirectory: string, reportDir: string) {
    return `
        allprojects { apply plugin: 'jacoco' }

allprojects {
	repositories {
        mavenCentral()
    }
}

def jacocoExcludes = [${excludeFilter}]
def jacocoIncludes = [${includeFilter}]
	
jacocoTestReport {
	doFirst {
		classDirectories = fileTree(dir: "${classFileDirectory}").exclude(jacocoExcludes).include(jacocoIncludes)
	}
		
	reports {
	    html.enabled = true
        xml.enabled = true    
	    xml.destination "${reportDir}/summary.xml"
	    html.destination "${reportDir}/"
    }
}
	
test {
    finalizedBy jacocoTestReport
	jacoco {
		append = true
		destinationFile = file("${reportDir}/jacoco.exec")
	}
}`;
}


// Enable Cobertura Code Coverage for Gradle builds using this props
export function coberturaGradleSingleModuleEnable(excludeFilter: string, includeFilter: string, classDir: string, sourceDir: string, reportDir: string) {
    if (!classDir) {
        classDir = "${project.sourceSets.main.output.classesDir}";
    }
    if (!sourceDir) {
        sourceDir = "project.sourceSets.main.java.srcDirs";
    }

    return `
allprojects {
    repositories {
        mavenCentral()
    }
    apply plugin: 'net.saliman.cobertura'
	
    dependencies {
	    testCompile 'org.slf4j:slf4j-api:1.7.12'
    }

    cobertura.coverageIncludes = [${includeFilter}]
    cobertura.coverageExcludes = [${excludeFilter}]
}

cobertura {
    coverageDirs = ["${classDir}"]
    coverageSourceDirs = ${sourceDir}
    coverageReportDir = new File('${reportDir}')
    coverageFormats = ['xml', 'html']
}`;
}
export function coberturaGradleMultiModuleEnable(excludeFilter: string, includeFilter: string, classDir: string, sourceDir: string, reportDir: string) {
    var data = `
allprojects {
    repositories {
        mavenCentral()
    }
    apply plugin: 'net.saliman.cobertura'
	
    dependencies {
	    testCompile 'org.slf4j:slf4j-api:1.7.12'
    }

    cobertura.coverageIncludes = [${includeFilter}]
    cobertura.coverageExcludes = [${excludeFilter}]
}
    
test {
    dependsOn = subprojects.test
}

cobertura {	
    coverageSourceDirs = []`;

    if (classDir) {
        data += `
        coverageDirs = ["${classDir}"]`;
    } else {
        data += `
    rootProject.subprojects.each {
		coverageDirs << file("\${it.sourceSets.main.output.classesDir}")
    }`;
    }

    if (sourceDir) {
        data += `
    coverageDirs = ["${sourceDir}"]`;
    } else {
        data += `
    rootProject.subprojects.each {
		coverageSourceDirs += it.sourceSets.main.java.srcDirs
    }`;
    }
    data += `
    coverageFormats = [ 'xml', 'html' ]
    coverageMergeDatafiles = subprojects.collect { new File(it.projectDir, '/build/cobertura/cobertura.ser') }
    coverageReportDir = new File('${reportDir}')
}`;

    return data;
};

// Enable Jacoco Code Coverage for Maven builds using this props
export function jacocoMavenPluginEnable(includeFilter: string, excludeFilter: string, destFile: string, outputDirectory: string): any {
    return {
        "groupId": "org.jacoco",
        "artifactId": "jacoco-maven-plugin",
        "version": "0.7.5.201505241946",
        "configuration": {
            "destFile": destFile,
            "outputDirectory": outputDirectory,
            "dataFile": destFile,
            "append": "true"
        },
        "executions": {
            "execution": [
                {
                    "configuration": {
                        "includes": { "include": includeFilter },
                        "excludes": { "exclude": excludeFilter }
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
    }
};
export function jacocoMavenMultiModuleReport(jacocoExec: string, reportDir: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
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
                    <file file="${jacocoExec}" />
                  </executiondata>
                  <structure name="Jacoco report">
                    <classfiles>
                      <fileset dir="." />
                    </classfiles>
                    <sourcefiles encoding="UTF-8">
                      <fileset dir="." />
                    </sourcefiles>
                  </structure>
                  <html destdir="${reportDir}" />
                  <xml destfile="${reportDir + path.delimiter}jacoco.xml" />
                  <csv destfile="${reportDir + path.delimiter}report.csv" />
                </report>
              </target>
            </configuration>
          </execution>
        </executions>
        <dependencies>
          <dependency>
            <groupId>org.jacoco</groupId>
            <artifactId>org.jacoco.ant</artifactId>
            <version>0.7.5.201505241946</version>
          </dependency>
        </dependencies>
      </plugin>
    </plugins>
  </build>
</project>
    `
};

// Enable Cobertura Code Coverage for Maven builds using this props
export function coberturaMavenEnable(includeFilter: string, excludeFilter: string, aggregate: string) {
    return `
    <plugins>
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
            <includes>${includeFilter}</includes>
            <excludes>${excludeFilter}</excludes>
          </instrumentation>
          <aggregate>${aggregate}</aggregate>
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
    </plugins>
  </build>
  <reporting>
    <plugins>
      <plugin>
        <groupId>org.codehaus.mojo</groupId>
        <artifactId>cobertura-maven-plugin</artifactId>
        <version>2.7</version>
        <configuration>
          <formats>
            <format>xml</format>
            <format>html</format>
          </formats>
        </configuration>
      </plugin>
    </plugins>
  </reporting>
  `
};

export function jacocoAntReport(reportFile: string, reportDir: string, classData: string, sourceData: string): string {
    return `
      <?xml version='1.0'?>
        <project name='JacocoReport'>
               <target name='CodeCoverage_9064e1d0'>
                  <jacoco:report xmlns:jacoco='antlib:org.jacoco.ant'>
                      <executiondata>
                         <file file='${reportFile}'/>
                      </executiondata>
                      <structure name = 'Jacoco report'>
                            <classfiles>${classData}</classfiles>
                            <sourcefiles>${sourceData}</sourcefiles>
                      </structure>
                      <html destdir='${reportDir}' />
                      <csv destfile='${reportDir + path.delimiter}summary.csv' />
                      <xml destfile='${reportDir + path.delimiter}summary.xml' />
                  </jacoco:report>
              </target>
        </project>
    `;
}

export function jacocoAntCoverageEnable(): any {
    return {
        $:
        {
            "destfile": "jacoco.exec",
            "append": true,
            "xlmns:jacoco": "antlib:org.jacoco.ant"
        }
    }
}

export function coberturaAntReport(): string {
    return `
    <?xml version="1.0"?>
<project name="CoberturaReport">
  <property environment="env" />
  <path id="cobertura-classpath" description="classpath for instrumenting classes">
    <fileset dir="\${env.COBERTURA_HOME}">
      <include name="cobertura*.jar" />
      <include name="**/lib/**/*.jar" />
    </fileset>
  </path>
  <taskdef classpathref="cobertura-classpath" resource="tasks.properties" />
  <target name="CodeCoverage">
    <cobertura-report format="html" destdir="ReportDirectory75C12DBC" datafile="ReportDirectory75C12DBC\cobertura.ser" srcdir="." />
    <cobertura-report format="xml" destdir="ReportDirectory75C12DBC" datafile="ReportDirectory75C12DBC\cobertura.ser" srcdir="." />
  </target>
</project>
    `;
}

export function coberturaAntCoverageEnable(): any {
    let ccProperty = `
    <property environment="env" />
    <path id="cobertura-classpath" description="classpath for instrumenting classes">
        <fileset dir="\${env.COBERTURA_HOME}">
            <include name="cobertura*.jar" />
            <include name="**/lib/**/*.jar" />
        </fileset>
    </path>
    <taskdef classpathref="cobertura-classpath" resource="tasks.properties" />
    `
    return util.convertXmlStringToJson(ccProperty).valueOf();
}

export function coberturaAntInstrumentedClasses(): any {
    let ccProperty = `
    <cobertura-instrument todir="\${basedir}\InstrumentedClasses" datafile="\${basedir}\ReportDirectory75C12DBC\cobertura.ser">
      <fileset dir="." />
    </cobertura-instrument>
`
    return util.convertXmlStringToJson(ccProperty).valueOf();
}

export function coberturaAntProperties(): any {
    let ccProperty = `
    <sysproperty key="net.sourceforge.cobertura.datafile" file="\${basedir}\ReportDirectory75C12DBC\cobertura.ser" />
    <classpath location="\${basedir}\InstrumentedClasses" />
    <classpath refid="cobertura-classpath" />
    `
    return util.convertXmlStringToJson(ccProperty).valueOf();
}

// Gradle Coberutra plugin
export const coberturaGradleBuildScript = `buildscript {
    repositories {
        mavenCentral()
    }
    dependencies {
        classpath 'net.saliman:gradle-cobertura-plugin:2.2.7'
    }
}
`;