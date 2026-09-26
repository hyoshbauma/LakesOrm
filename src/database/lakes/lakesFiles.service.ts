//
import { Injectable } from "../../../container";
import { TableTemplateService } from "./templates/table.template";
import { ToolLakesService } from "./tools/tools.service";
import { MigrationTemplateService } from "./templates/migration.template";
import { databaseDataPath, schemaPath } from "./tools/location";
import type {  DatabaseJson, DateTimeLakes, TableSchema } from "./interfaces/structure";

const structure = databaseDataPath + '/database.json';


@Injectable()
export class LakesFilesService 
{
    // Accepts dependencies through constructor injection
    constructor(
        private toolService: ToolLakesService,
        private tableTemplateService: TableTemplateService,  
        private migrationTemplateService : MigrationTemplateService) {}

    
    // set the name
    private tableNamesFactory(name :string) : TableSchema{
        
        const tableName = name.toLowerCase();
        const tableClass:string = this.toolService.capitalizeFirstLetter(tableName);
    
        const dateTime : DateTimeLakes = this.toolService.getDateTime();
    
        const timestamp: string = `${dateTime.yeah}_${dateTime.month}_${dateTime.day}_${dateTime.hours}${dateTime.minutes}${dateTime.seconds}`;
        
        const tableNames: TableSchema = {name: tableName,  class:tableClass, migration: timestamp }
        
        return tableNames;
    }

    /**
     * 
     * get the JSON file 
     */
    private async getDbJsonSchema ()
    {

        const file = Bun.file(structure);

        // Check if the file exists (returns a Promise<boolean>)
        const fileExists = await file.exists(); 

        // create file if it doesn't exist
        if (!fileExists)
        {  
            // set the structure
            await this.updateDbSchema({ name : 'lakes', tables: [], tableCount : 0 , migration : [] });

            const file = Bun.file(structure);

            const data = await file.json();

            return data;
        } 

        const data = await file.json();
        
        return data;
    }

    /***/
    private async generatreSchemaFile()
    {

        const tables = await this.databaseTables();

        const interfaces = this.databaseInterface(tables);
        
        return await Bun.write(schemaPath, interfaces);
    }


    private async updateDbSchema (db: DatabaseJson)
    {
        // Writes the data object into 'data.json' formatted with 2 spaces of indentation
        await Bun.write(structure, JSON.stringify(db, null, 2));

        // regenerate the schema
        await this.generatreSchemaFile();
    }


    private databaseInterface(tables : TableSchema[]): string
    {
        // import the files
        let importBuilder = '';

        // tables String schema
        let tableStringBuilder: string = '\n// This enables type-safe table selection \nexport interface DatabaseSchema {';

        // looping in the tables
        for (let index = 0; index < tables.length; index++) {
            //
            let table : TableSchema | undefined = tables[index];

            // import the table class files
            importBuilder = importBuilder + `\nimport type { ${table?.class} } from "../tables/${table?.name }";`;

            // add the table class in the interface
            tableStringBuilder = tableStringBuilder + '\n'+ '  '+ table?.name+ ' : ' + table?.class + ';';
            
        }

        // closing the interface
        tableStringBuilder = tableStringBuilder + '\n'+ '}';

        tableStringBuilder = tableStringBuilder + '\n'+ '\n' + `
        
// Helper type to extract column names from a table
// keyof User returns 'id' | 'email' | 'name' | 'created_at' | 'is_active'
export type ColumnNames<T> = keyof T & string;

// Helper type to get the value type of a specific column
export type ColumnType<T, K extends keyof T> = T[K];`;


        const schema: string = importBuilder +'\n'+ tableStringBuilder;

        return schema;

    }

    /*
    *
    **/
    protected async databaseTables(): Promise<TableSchema[]>
    {

        // database
        const database: DatabaseJson = await this.getDbJsonSchema();

        // tables schema
        let tables: TableSchema[] = database.tables;

        return tables;
    }

    private async getDatabaseTable(tableName : string): Promise<TableSchema | null>
    {
        const tables: TableSchema[] = await this.databaseTables();

        // Find the object where the id matches 3
        const result = tables.find(table => table.name === tableName.toLowerCase());

        // if table was found
        if(result) return result;

        console.log('TableSchema can not be found');

        return null;
    }


    private ifTableExist(tableName : string, database : DatabaseJson ): boolean
    {

        let tables = database.tables;

        // Find the object where the id matches 3
        const result : TableSchema | undefined = tables.find(table => table.name === tableName.toLowerCase());

        // check if the table was already created
        if(result)
        {
            const error  = `Table ${tableName} already exit`;
            console.log(error);
            return true;  
        }

        return false;  
    }


    private async addTableJson(tableSchema: TableSchema  )
    {

        // get the database
        const database: DatabaseJson = await this.getDbJsonSchema();

        // check if the table exist
        if(this.ifTableExist(tableSchema.name, database)) throw new Error("table already created");

        // push new table
        database.tables.push(tableSchema);
        // database.list.push(tableSchema.name);

        // adjust the count
        database.tableCount = database.tables.length; 
        
        // update database
        await this.updateDbSchema(database);
    }

    private async deleteTableJson(tableName : string )
    {

        // get the database
        const database: DatabaseJson = await this.getDbJsonSchema();


        database.tables = database.tables.filter((element, index, array) => {
            // Return true to keep the element, false to discard it
            return element.name != tableName.toLowerCase()
            });

        // database.list = database.list.filter((element, index, array) => {
        //     // Return true to keep the element, false to discard it
        //     return element !== tableName.toLowerCase()
        //     });

        // adjust the count
        database.tableCount = database.tables.length; 

        // update database
        await this.updateDbSchema(database);
    }


    /****/
    public async createTableFiles(tableName : string): Promise<void>
    {
        
        try {

            // factory of the table name
            const tableSchema: TableSchema = this.tableNamesFactory(tableName);

            // add the table to the JSON Database
            await this.addTableJson(tableSchema);

            // create a table Class file
            await this.tableTemplateService.createFile(tableSchema);

            // create a table Migration file
            await this.migrationTemplateService.createFile(tableSchema);
            
        } catch (error) {
            
        }

    }


    public async deteleTableFiles(tableName : string): Promise<string | void>
    {
        try {

            // factory of the table name
            const tableSchema : TableSchema  | null =   await this.getDatabaseTable(tableName);

            // check if the tabke exist
            if(!tableSchema) return ;

            // check if the table exist
            await this.deleteTableJson(tableName);
            // delete a table class file
            await this.tableTemplateService.deleteFile(tableSchema!);
            // delete a table Migration file
            await this.migrationTemplateService.deleteFile(tableSchema!); 
            
        } catch (error) {
            console.log(error);
        } 
    }

    
}








