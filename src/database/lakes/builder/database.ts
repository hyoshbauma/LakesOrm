import  { Pool, type QueryResult } from 'pg';
import { Singleton } from '../../../../container';
import type { CamelizeKeys } from '../types/type-case';
import { CryptoAes256C } from '../tools/crypto';
import type { BuiltQuery } from '../interfaces/structure';
import type { LakesOrm } from '../interfaces/driver';
import { randomUUID } from 'crypto';


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

                if(this.encryptedIds.includes(snakeKey))
                {
                    result[snakeKey] = this.encryptId(obj[key]);
                    continue;
                }

                if(this.encryptedColumns.includes(snakeKey))
                {
                    result[snakeKey] = this.dbEcncryption(obj[key]);
                    continue;
                }
                
                result[snakeKey] = obj[key];
            }
            return result;
    }


    // Deep object transformer combining runtime and types
    protected camelizeKeys<T>(obj: T, nested: boolean = false): T {
        if (obj instanceof Date) {
            return obj as any;
        }
        // if (obj instanceof encrypted) {
        //     return obj as any;
        // }
        if (Array.isArray(obj)) {
            return obj.map((v) => this.camelizeKeys(v, nested)) as any;
        }
        if (obj !== null && typeof obj === 'object') {
            return Object.fromEntries(
            Object.entries(obj).map(([key, value]) =>
                { 
                    // encrypted ids are columns of the row itself, not keys inside a JSON value
                    if(!nested && this.encryptedIds.includes(key)){
                        return [
                            key.replace(/_([a-z])/g, (_, char) => char.toUpperCase()),
                            this.decryptId(value),
                        ];
                    }

                    // // get the encrypted columns and decrypt them
                    if(this.encryptedColumns.includes(key)){
                        return [
                            key.replace(/_([a-z])/g, (_, char) => char.toUpperCase()),
                            this.camelizeKeys(this.decryptValue(value)),
                        ];
                        
                    }

                    // nothing to decrypte
                    return [
                        key.replace(/_([a-z])/g, (_, char) => char.toUpperCase()),
                        this.camelizeKeys(value, true),
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

    // one cipher per key: deriving the key is slow, so it is done once
    private static ciphers = new Map<string, CryptoAes256C>();
    private static warnings = new Set<string>();

    protected cipher(): CryptoAes256C
    {
        const appKey = process.env.APP_KEY;

        if (!appKey) Database.warnOnce("LakesORM: APP_KEY is not set, encrypted columns use the built-in key, which is public");

        return this.cipherFor(appKey || undefined);
    }

    // APP_KEY is the key itself: 32 random bytes, base64-encoded (openssl rand -base64 32).
    // Without it, the built-in key keeps its original derivation, so values encrypted with it stay readable
    private cipherFor(appKey?: string): CryptoAes256C
    {
        const key = appKey ?? this.appKey;

        let cipher = Database.ciphers.get(key);

        if (!cipher) {
            cipher = new CryptoAes256C(appKey ? Database.appKeyBytes(appKey) : key);
            Database.ciphers.set(key, cipher);
        }

        return cipher;
    }

    private static appKeyBytes(appKey: string): Buffer
    {
        const encoded = appKey.replace(/^base64:/, '');
        const bytes = Buffer.from(encoded, 'base64');

        // Buffer.from() skips characters that are not base64, so the encoding is checked by re-encoding
        if (bytes.length !== 32 || bytes.toString('base64') !== encoded) {
            throw new Error("LakesORM: APP_KEY must be 32 random bytes, base64-encoded (openssl rand -base64 32)");
        }

        return bytes;
    }

    // a value stored before APP_KEY was set is encrypted with the built-in key: it is still read,
    // and is encrypted with APP_KEY the next time it is written
    protected decryptValue(value: any): any
    {
        if (value == null || value === '') return value;

        try {
            return this.cipher().decrypt(value);
        } catch (error) {
            if (!process.env.APP_KEY) throw error;

            let plain: string;
            try {
                plain = this.cipherFor(undefined).decrypt(value);
            } catch {
                throw error;
            }

            Database.warnOnce("LakesORM: a value encrypted with the built-in key was read; it is encrypted with APP_KEY when it is written again");
            return plain;
        }
    }

    private static warnOnce(message: string): void
    {
        if (Database.warnings.has(message)) return;

        Database.warnings.add(message);
        console.warn(message);
    }

    protected dbEcncryption(value: string): string
    {
        if (value == null) return value;

        return this.cipher().encrypt(value);
    }

    // id columns stored encrypted and still searchable: the id, and foreign keys that point at one
    protected encryptedIds: string[] = [];

    public withEncryptedIds(columns: string[]): this
    {
        this.encryptedIds = columns.map((column) => this.camelToSnakeCase(column));

        return this;
    }

    // the built-in key is public: an id encrypted with it would not be protected
    private idCipher(): CryptoAes256C
    {
        if (!process.env.APP_KEY) {
            throw new Error("LakesORM: encrypted ids need APP_KEY to be set");
        }

        return this.cipher();
    }

    // equal ids give equal ciphertexts, so an encrypted id can still be compared and joined
    protected encryptId(value: any): any
    {
        return value == null ? value : this.idCipher().encryptDeterministic(String(value));
    }

    protected decryptId(value: any): any
    {
        return value == null ? value : this.idCipher().decryptDeterministic(value);
    }

    // a value compared with an encrypted id has to be encrypted the same way
    protected idParam(column: string, value: any, operator: string = '='): any
    {
        if (!this.encryptedIds.includes(this.camelToSnakeCase(column))) return value;

        if (operator !== '=' && operator !== '!=') {
            throw new Error(`LakesORM: '${operator}' cannot be used on '${column}', an encrypted id only supports =, != and whereIn`);
        }

        return this.encryptId(value);
    }

    protected newId(): string
    {
        return randomUUID();
    }

    // the database cannot generate an encrypted id: rows without one get a UUID
    protected withIds<R>(rows: R[]): R[]
    {
        if (!this.encryptedIds.includes('id')) return rows;

        return rows.map((row: any) => row.id == null ? { ...row, id: this.newId() } : row);
    }
    
    
}