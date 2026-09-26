import  { Pool, type QueryResult } from 'pg';
import { Singleton } from '../../../../container';
import type { CamelizeKeys } from '../types/type-case';
import { CryptoAes256C } from '../tools/crypto';
import type { BuiltQuery } from '../interfaces/structure';
import type { LakesOrm } from '../interfaces/driver';


// connection to the db
// @Singleton
export class Database {

    // Prostgres
    protected lakesOrm: LakesOrm;
    // Prostgres
    protected postgres?: Pool ;
    // Mysql
    protected mysql?: Pool;
    // database driver
    public driver: string;
    //
    public appKey: string;

    protected encryptedColumns: string[] = [];

    constructor() {
        // database driver
        this.driver = process.env.DB_CONNECTION!;
        // database connection
        this.lakesOrm = this.connectionDb(this.driver);

        this.appKey = "base64:P1G6tpneoQAlRZbZgdZ4on/8zMM+33JAtFT9VJn1Qc=";
    }

    /**
     *  Prostgres connection
     **/
    private postgresConnection() : Pool
    {
        const connectionString: string = process.env.DATABASE_URL!;
        this.postgres = new Pool({ connectionString });

        return this.postgres;
    }

    /**
     *  Prostgres connection
     **/
    private mysqlConnection()
    {
        const connectionString: string = process.env.DATABASE_URL!;
        // Create the connection pool
        // const pool = this.mysql.createPool({
        //     host: process.env.DB_HOST || 'localhost',
        //     user: process.env.DB_USER || 'root',
        //     password: process.env.DB_PASSWORD || '',
        //     database: process.env.DB_NAME || 'test_db',
        //     waitForConnections: true,
        //     connectionLimit: 10,
        //     queueLimit: 0,
        // });


    }



    /**
     *   connection
     **/
    private connectionDb(driver : string): LakesOrm
    {
        // connection to postgres
        if(driver == 'pgsql'){
            
            return {
                driver: driver,
                db: this.postgresConnection()
            }
        }

        // connection to mysql
        if(driver == 'mysql'){
            return {
                driver: driver,
                db: this.postgresConnection()
            }
        }

        // can't find the Driver
        console.log("Can't find the driver");

        return {
            driver: driver,
            db: null
        }
    }


    // Execute a query and return typed results
    protected async execute<T>(query: BuiltQuery): Promise<T[]> {
        const result: QueryResult = await this.lakesOrm.db.query(
        query.sql,
        query.params
        );

        try {
            return result.rows;

        } catch (error : any) {
            console.log("Error : "+error.message);
        }

        return [];
    }

    // Execute and return single result
    protected async executeOne<T>(query: BuiltQuery): Promise<T | null> {
        
        try {

            const results = await this.execute<T>(query);
            return results[0] || null;

        } catch (error:any) {

            console.log("Error : "+ error.message);
            
            return null;
        }
    }

    protected camelToSnakeCase(str: string): string {
            return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    }

    protected camelToSnakeCaseList(str: string[]): string[] {

            let listString : string[] = [];

            for (let index = 0; index < str.length; index++) {

                const element:string = str[index]!;

                listString.push(this.camelToSnakeCase(element));
                
            }
            return listString;
    }

    protected convertKeysToSnakeCase(obj: Record<string, any>): any {
            //
            const result: Record<string, any> = {};

            for (const key of Object.keys(obj)) {
                const snakeKey = this.camelToSnakeCase(key);

                if(this.encryptedColumns.includes(key))
                {
                    result[snakeKey] = new CryptoAes256C(this.appKey).encrypt(obj[key]);
                    continue;
                }
                
                result[snakeKey] = obj[key];
            }
            return result;
    }


    // Deep object transformer combining runtime and types
    protected camelizeKeys<T>(obj: T): T {
        if (obj instanceof Date) {
            return obj as any;
        }
        // if (obj instanceof encrypted) {
        //     return obj as any;
        // }
        if (Array.isArray(obj)) {
            return obj.map((v) => this.camelizeKeys(v)) as any;
        }
        if (obj !== null && typeof obj === 'object') {
            return Object.fromEntries(
            Object.entries(obj).map(([key, value]) =>
                { 
                    // // get the encrypted columns and decrypt them
                    if(this.encryptedColumns.includes(key)){
                        return [
                            key.replace(/_([a-z])/g, (_, char) => char.toUpperCase()),
                            this.camelizeKeys(new CryptoAes256C(this.appKey).decrypt(value)),
                        ];
                        
                    }

                    // nothing to decrypte
                    return [
                        key.replace(/_([a-z])/g, (_, char) => char.toUpperCase()),
                        this.camelizeKeys(value),
                    ];
        
        })
            ) as any;
        }
        return obj as any;
    }

    // Deep object transformer combining runtime and types
    protected camelizeList<T>(objRows: T[]): T[] {
        // set the empty list
        let rows : T[] = [];

        // loop in the whole list
        for (let index = 0; index < objRows.length; index++) {
            // convert the snake_case keys to camel_case
            const data : T = this.camelizeKeys(objRows[index]!);
            rows.push(data);
            
        }

        return rows;
    }

    protected dbEcncryption(value: string): string
    {
        return new CryptoAes256C(this.appKey).encrypt(value);   
    }
    
    
}