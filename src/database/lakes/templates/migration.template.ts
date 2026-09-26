

import type { DateTimeLakes, TableSchema } from "../interfaces/structure";
import { lakesTableMigrationPath } from "../tools/location";
import { Injectable, Singleton } from "../../../../container";
import { ToolLakesService } from "../tools/tools.service";


@Injectable()
export class MigrationTemplateService {

  constructor(protected toolServices : ToolLakesService){}

  // Define the structure of each table
  async createFile(table: TableSchema) : Promise<string> {

  const tableName = table.name;
  const tableClass :string = table.class;

  const name: string = `${tableName}`;

  const laketableClass : string = `${tableClass}Table`;

  const timestamp: string = table.migration; 

  const fileNanme =  timestamp +'_'+'create_'+ name;


  const content = `

import { AbstractMigration } from "@blm/lakeorm";
import { ${laketableClass}, type ${tableClass} } from "../tables/${tableName}";

export class Migration implements AbstractMigration<${tableClass}> {

  protected name: string  = '${name}s';

  protected timestamp : number = ${timestamp.replaceAll('_','')};
  
  // Run your schema changes here
  public async up(): Promise<${tableClass} | null> {
          
    return new ${laketableClass}().createTable()
      .addColumn('id', 'SERIAL', { primaryKey: true })
      .addColumn('createdAt', 'TIMESTAMP WITH TIME ZONE', {defaultFn: 'NOW()'})
      .addColumn('updatedAt', 'TIMESTAMP WITH TIME ZONE', {defaultFn: 'NOW()'})
      .save();
  }
  
  // Reverse your schema changes here (Rollback)
  public async down(): Promise<${tableClass} | null> {
           
    return new ${laketableClass}().dropTable().save();

  }
}
    
   `;

    const tableMigrationPath: string = `${lakesTableMigrationPath}/migration/${fileNanme}.ts`;

    await Bun.write(tableMigrationPath, content);

    console.log(` - table ${tableClass} Migraton file created successfully!`);

    return fileNanme;
  }


  /**
   *  delete Table Migration File 
   * **/
  async  deleteFile(table: TableSchema)
  {

    const tableMigrationPath: string = `${lakesTableMigrationPath}/migration/${table.migration}_create_${table.name}.ts`;

    const file = Bun.file(tableMigrationPath);

    // Check if the file exists (returns a Promise<boolean>)
    const fileExists = await file.exists(); 

    // create file if it doesn't exist
    if (!fileExists)
    {
      const error  = "Migration File doesn't exist";
      console.log(error);
      // throw new Error(error);
      return;
      
    }  

    // Delete the file asynchronously
    await file.delete();

    console.log(` - table ${table.class} Migration file deleted successfully!`)
  
  }

}