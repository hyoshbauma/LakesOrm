import type { BuiltQuery, ColumnType, IndexDefinition } from "../interfaces/structure";
import type { DatabaseSchema } from "../interfaces/schema";
import type { ColumnNames, DataType, defaultFn, foreignKeyAction, RelationTable } from "../types/type-db";
import { Database } from "./database";

// Create builder with type-safe column values
export class CreateTableBuilder<T extends object, S extends object = DatabaseSchema> extends Database{
  protected tableName: string;
  protected columns: ColumnType[] = [];
  protected indexes: IndexDefinition<T>[] = [];

  constructor(table: string,) {
    super();
    this.tableName = this.camelToSnakeCase(table);
  }

  /** Adds a column to the table with fluent constraint configurations */
  public addColumn(
    name: ColumnNames<T>, 
    type: DataType, 
    constraints?: 
    { 
      nullable?: boolean; 
      primaryKey?: boolean; 
      unique?: boolean; 
      default?: string |number; 
      defaultFn?: defaultFn; 
      foreignKey? : 
      {
        table : Exclude<keyof DatabaseSchema, T>, 
        column : string, 
        onDelete?: foreignKeyAction, 
        onUpdate?: foreignKeyAction 
      }
    },
  ): this {
    this.columns.push({
      name,
      type,
      nullable: constraints?.nullable ?? true,
      primaryKey: constraints?.primaryKey ?? false,
      unique: constraints?.unique ?? false,
      defaultValue: constraints?.default ?? constraints?.defaultFn,
      references: constraints?.foreignKey ? 
      { 
        table: constraints!.foreignKey!.table, 
        column: constraints!.foreignKey!.column, 
        onUpdate: constraints?.foreignKey.onUpdate,
        onDelete: constraints?.foreignKey.onDelete
      } : undefined
    });
    return this;
  }

  /** Adds an index on column of the table */
  addIndex(indexName: string, columns: ColumnNames<T>[]): this {
    this.indexes.push({ name: indexName, columns });
    return this;
  }

  build(): BuiltQuery {
    if (this.columns.length === 0) {
      throw new Error(`Cannot generate CREATE TABLE for '${this.tableName}' without columns.`);
    }

    const columnDefs = this.columns.map(col => {
      const parts = [`"${this.camelToSnakeCase(col.name)}"`, col.type];
      
      if (col.primaryKey) parts.push('PRIMARY KEY');
      if (!col.nullable && !col.primaryKey) parts.push('NOT NULL');
      if (col.unique) parts.push('UNIQUE');
      if (col.defaultValue !== undefined) parts.push(`DEFAULT ${col.defaultValue}`);

      if(col.references !== undefined ) {
        let sql: string = ` REFERENCES ${col.references.table}s (${col.references.column})`
        if (col.references.onDelete) sql += ` ON DELETE ${col.references.onDelete}`;
        if (col.references.onUpdate) sql += ` ON UPDATE ${col.references.onUpdate}`;
        parts.push(sql)
      } 
      
      return parts.join(' ');
    });

    const tableSql : string = `CREATE TABLE "${this.camelToSnakeCase(this.tableName)}" (\n  ${columnDefs.join(',\n  ')}  \n);`;

    const indexSql = this.indexes.map(idx => {
      const cols = idx.columns.map(c => `"${c}"`).join(', ');
      return `CREATE INDEX IF NOT EXISTS "${idx.name}" ON "${this.tableName}" (${this.camelToSnakeCase(cols)});`;
    }).join('\n');

    return {
      sql: indexSql ? `${tableSql} \n ${indexSql}` : tableSql,
      params: []
    };
  }

  // create the table on the database
  save<T>(): Promise<T | null> {
    const build = this.build();
    return this.executeOne(this.build());
  }
}



// delete table query builder
export class DeleteTableBuilder<T extends object, S extends object = DatabaseSchema> extends Database {
  private tableName: string;

  constructor(table: string) {
    super();
    this.tableName = table;
  }

  // save the table data on the database
  save<T>(): Promise<T | null> {

    const query : BuiltQuery = {
      sql: `DROP TABLE IF EXISTS ${this.tableName} CASCADE ;`,
      params: []
    };
    
    return this.executeOne(query);
  }
}

export class AlterTableBuilder<T extends object, S extends object = DatabaseSchema> extends CreateTableBuilder<T> {
  protected override tableName: string;
  protected override columns: ColumnType[] = [];
  private columnsDrop: string[] = [];
  protected override indexes: IndexDefinition<T>[] = [];

  constructor(table: string,) {
    super(table);
    this.tableName = this.camelToSnakeCase(table);
  }

  /** Adds a column to the table with fluent constraint configurations */
  // public addColumn(
  //   name: string, 
  //   type: DataType, 
  //   constraints?: { nullable?: boolean; primaryKey?: boolean; unique?: boolean; default?: string|number ; foreignKey? : {table? : Exclude<keyof DatabaseSchema, T>, column? : string }},
  // ): this {
  //   this.columns.push({
  //     name,
  //     type,
  //     nullable: constraints?.nullable ?? true,
  //     primaryKey: constraints?.primaryKey ?? false,
  //     unique: constraints?.unique ?? false,
  //     defaultValue: constraints?.default,
  //     references: constraints?.foreignKey ? { table: constraints!.foreignKey!.table, column: constraints?.foreignKey?.column} : undefined
  //   });
  //   return this;
  // }

  /** drops a column to the table with fluent constraint configurations */
  public dropColumn(
    name: string
  ): this {
    this.columnsDrop.push(name);
    return this;
  }

  /** build the sql query */
  public override build(): BuiltQuery {

    const columnAddDefs = this.columns.map(col => {
      const parts = [`"${this.camelToSnakeCase(col.name)}"`, col.type];
      
      if (col.primaryKey) parts.push('PRIMARY KEY');
      if (!col.nullable && !col.primaryKey) parts.push('NOT NULL');
      if (col.unique) parts.push('UNIQUE');
      if (col.defaultValue !== undefined) parts.push(`DEFAULT ${col.defaultValue}`);
      // references
      if(col.references !== undefined ) {
        let sql: string = ` REFERENCES ${col.references.table}s (${col.references.column})`
        if (col.references.onDelete) sql += ` ON DELETE ${col.references.onDelete}`;
        if (col.references.onUpdate) sql += ` ON UPDATE ${col.references.onUpdate}`;
        parts.push (sql)
      } 
      
      return parts.join(' ');
    });

    const columnDropDefs = this.columnsDrop.map(col => {
      const parts = [`DROP COLUMN "${this.camelToSnakeCase(col)}"`,];
      return parts.join(' ');
    });

    const addKey : string = this.columns.length ? ' ADD ' : '';
    const addComma : string = this.columnsDrop.length ?  (this.columns.length ?  ', \n' : ' ') : '';

    let tableSql = `ALTER TABLE ${this.tableName}${addKey}${columnAddDefs.join(',\n')}${addComma}${columnDropDefs.join(',\n')};`.trim();

    const indexSql = this.indexes.map(idx => {
      const cols = idx.columns.map(c => `"${c}"`).join(', ');
      return `CREATE INDEX IF NOT EXISTS "${idx.name}" ON "${this.tableName}" (${this.camelToSnakeCase(cols)});`;
    }).join('\n');

    return {
      sql: indexSql ? `${tableSql} \n ${indexSql}` : tableSql,
      params: []
    };
  }
  
  // create the table on the database
  override save<T>(): Promise<T | null> {
    // const build = this.build();
    return this.executeOne(this.build());
  }
}