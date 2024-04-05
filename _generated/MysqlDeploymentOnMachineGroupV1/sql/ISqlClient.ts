
export interface ISqlClient {

    /**
     * Execute sql command in asynchronously
     * 
     * @returns response code promise  
     */
    executeSqlCommand(): Promise<number>;

}
