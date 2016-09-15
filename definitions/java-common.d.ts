/// <reference path="./vsts-task-lib.d.ts" />

declare module 'java-common/java-common' {

    /**
     * Find the installation path for the specified Java version.  This function checks user defined environment variable
     * first.  The variables should be defined as JAVA_HOME_${VERSION}_${ARCH}, for example: JAVA_HOME_6_X86, and the 
     * value of the variable should be the path to the JDK installation, such as /usr/lib/jvm/jdk1.6.0_45 or C:\Program Files(x86)\Java\jdk1.6.0_45.
     * If the environment variable is not set, on Windows platform it will attemp to find the installation path from registry.
     * If the path to the specific java installation is not found, this function will throw.
     * @param jdkVersion, the major version of java, e.g. 1.6, 1.7, 1.8, or 1.10
     * @param jdkArch, 'x86' or 'x64', case insensitive
     * @returns {string} installation path, e.g. c:\Program Files\Java\jdk1.6.0_45
     */ 
    export function findJavaHome(jdkVersion: string, jdkArch: string): string;
}
