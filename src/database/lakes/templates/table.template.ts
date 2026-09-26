

import type { TableSchema } from "../interfaces/structure";
import { lakesTablePath } from "../tools/location";
import { Injectable } from "../../../../container";


@Injectable()
export class TableTemplateService {

  // Define the structure of each table
  async createFile(table: TableSchema) : Promise<void> {

  const tableName = table.name;
  const tableClass:string = table.class;


  const content = `
import { BaseModel, Injectable, Singleton } from "@blm/lakeorm";
import type { ColumnNames } from "../interfaces/schema";

// These types mirror your actual database tables
export interface ${tableClass} {
  readonly id? : number,
  createdAt?: Date,
  updatedAt?: Date,
}
  

/*
* ${tableClass} Table 
*/
@Singleton
@Injectable()
export class ${tableClass}Table extends BaseModel<${tableClass}>{

protected override tableName = '${tableName}s';
// column to encrypt
protected override encryptedColumns: ColumnNames<${tableClass}>[] = [];
// column to hide
protected override hidden : ColumnNames<${tableClass}>[] = [];
        
constructor()
  {
    super('${tableName}s');
  }
    
    
    
} `;

    

    const tablePath: string = `${lakesTablePath}/${tableName}.ts`;

    try {
      
      await Bun.write(tablePath, content);
    } catch (error) {
      console.log(error);
    }
    

    console.log(` ++ table ${tableName} File created successfully!`);
    console.log(` - table ${tableClass} Interace created successfully!`);
    console.log(` - table ${tableClass} Class created successfully!`);
  }


  /**
   *  drop table
   * **/
  async  deleteFile(table: TableSchema)
  {

    const tablePath: string = `${lakesTablePath}/${table.name}.ts`;

    const file = Bun.file(tablePath);

    // Check if the file exists (returns a Promise<boolean>)
    const fileExists = await file.exists(); 

    // create file if it doesn't exist
    if (!fileExists)
    {
      const error  = "Table File doesn't exist";
      console.log(error);
      return;
      
    }  

    // Delete the file asynchronously
    await file.delete();

    console.log(` -- table ${table.name} File Deleted successfully!`)
    console.log(` - table ${table.class} Interace Deleted successfully!`)
    console.log(` - table ${table.class} Interace Deleted successfully!`)
  
  }

}