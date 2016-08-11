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
export const jacocoMavenSingleModuleEnable = "";
export const jacocoMavenMultiModuleEnable = "";

// Enable Cobertura Code Coverage for Maven builds using this props
export const coberturaMavenSingleModuleEnable = "";
export const coberturaMavenMultiModuleEnable = "";

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