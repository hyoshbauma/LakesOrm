import type { BuiltQuery, WhereCondition } from "../interfaces/structure";
import type { CamelizeKeys } from "../types/type-case";
import type { ColumnNames, ValueOperator } from "../types/type-db";
import { Database } from "./database";




// Insert One builder with type-safe column values
export class CreateBuilder<T> extends Database {
  private tableName: string;
  private data: Partial<T> = {};

  constructor(table: string, encryptedColumns: string[]) {
    super();
    this.tableName = table;
    this.encryptedColumns = encryptedColumns.map( columnKey => this.camelToSnakeCase(columnKey));
  }

  // Set a column value with type safety
  set<K extends keyof T>(column: K, value: T[K]): this {
    this.data[column] = value;
    return this;
  }

  // Set multiple values at once
  values(data: Partial<T>): this {
    
    data =this.convertKeysToSnakeCase(data);
    this.data = { ...this.data, ...data };
    return this;
  }

  build(): BuiltQuery {
    const columns = Object.keys(this.data);
    const values = Object.values(this.data);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    return {
      sql: `INSERT INTO ${this.tableName} (${this.camelToSnakeCase(columns.join(', '))}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      params: values
    };
  }

  // save the table data on the database
  async save<T>(): Promise<CamelizeKeys<T| null>>{
    
    const query =  this.build();

    const data : any = await this.executeOne(query);

    if(data == null)
    {
      return null;
    }

    return this.camelizeKeys(data);
  }


}


// Insert builder with type-safe column values
export class InsertBuilder<T> extends Database {
  private tableName: string;
  private rows: T[] = [];

  constructor(table: string, encryptedColumns :string[]) {
    super();
    this.tableName = table;
    this.encryptedColumns = encryptedColumns.map( columnKey => this.camelToSnakeCase(columnKey));
  }

  // Set multiple values at once
  values(data: T[]): this {
    this.rows = data;
    return this;
  }

  // Compile into a parameterized SQL query and parameters array
  build(): BuiltQuery {
    if (this.rows.length === 0) {
      throw new Error("No data provided for bulk insert");
    }

    const keys = Object.keys(this.rows[0]!) as (keyof T)[];
    const valueClauses: string[] = [];
    const queryValues: any[] = [];
    
    let paramIndex = 1;

    for (const row of this.rows) {
      const rowClauses: string[] = [];

      for (const key of keys) {
        rowClauses.push(`$${paramIndex++}`);

        const tablekey = key as string;

        if(this.encryptedColumns.includes(this.camelToSnakeCase(tablekey)))
        {
          queryValues.push(this.dbEcncryption(row[key] as string));
          continue;
        }

        queryValues.push(row[key]);
      }
      valueClauses.push(`(${rowClauses.join(', ')})`);
    }

    const columns = this.camelToSnakeCase(keys.join(', '));

    return {
      sql: `INSERT INTO ${this.tableName} (${columns}) VALUES ${valueClauses.join(', ')} RETURNING * `,
      params: queryValues
    };
  }

  // save the table data on the database
  async  save<T>(): Promise<T[]> {

    const query =  this.build();

    const data : any = await this.execute(query);

    return this.camelizeKeys(data);
  }


}

// Update builder with type-safe SET and WHERE clauses
export class UpdateBuilder<T> extends Database {
  private tableName: string;
  private updates: Partial<T> = {};
  private conditions: WhereCondition[] = [];
  private params: unknown[] = [];

  constructor(table: string, encryptedColumns :string[]) {
    super();
    this.tableName = table;
    this.encryptedColumns = encryptedColumns.map( columnKey => this.camelToSnakeCase(columnKey));
  }

  set<K extends keyof T>(column: K, value: T[K]): this {

    //
    column = this.camelToSnakeCase(column as string) as K;

    if(this.encryptedColumns.includes(column as string))
    {
      this.updates[column] = this.dbEcncryption(value as string) as T[K];
      return this;
    }

    this.updates[column] = value;
    return this;
  }

  where<K extends keyof T & string>(
    column: K,
    operator: ValueOperator,
    value: T[K]
  ): this {
    this.conditions.push({ column, operator, value });
    return this;
  }

  build(): BuiltQuery {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    // Build SET clause
    for (const [column, value] of Object.entries(this.updates)) {
      setClauses.push(`${column} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }

    // Build WHERE clause
    const whereClauses = this.conditions.map(c => {
      params.push(c.value);
      return `${c.column} ${c.operator} $${paramIndex++}`;
    });

    let sql = `UPDATE ${this.tableName} SET ${setClauses.join(', ')} , updated_at = NOW() `;
    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    sql += ' RETURNING *';

    return { sql, params };
  }

  // update the table data on the database
  async save<T>(): Promise<T[]> {

    const query =  this.build();

    const data : any = await this.execute(query);

    return this.camelizeKeys(data);
  }
}


// insert mutiple data with conflict check
export class UpsertQueryBuilder<T> extends Database{
  private tableName: string;
  private insertData: T[] = [];
  private conflictColumns: ColumnNames<T>[] = [];
  private updateColumns: ColumnNames<T>[] = [];

  constructor(table: string, encryptedColumns :string[]) {
    super();
    this.tableName = table;
    this.encryptedColumns = encryptedColumns.map( columnKey => this.camelToSnakeCase(columnKey));
  }

  // Set the row data to insert
  public values(data: T[]): this {
    this.insertData = data;
    return this;
  }

  // Specify the unique constraint or primary key columns for conflict resolution
  public conflictOn(...columns: ColumnNames<T>[]): this {
    this.conflictColumns = columns.map( column => this.camelToSnakeCase(column)) as ColumnNames<T>[];
    return this;
  }

  // Specify which columns to update if a conflict occurs
  public doUpdateSet(...columns: ColumnNames<T>[]): this {
    this.updateColumns = columns.map( column => this.camelToSnakeCase(column)) as ColumnNames<T>[];
    return this;
  }

  // Compile the builder state into a parameterized SQL query
  public build(): BuiltQuery {
    //
    const insertKeys = Object.keys(this.insertData[0]!);
    const params: any[] = [];
    
    // Build rows placeholder values: ($1, $2), ($3, $4)
    const valueClauses: string[] = [];
    let paramIndex = 1;

    for (const row of this.insertData) {
      const rowParams: string[] = [];
      for (const key of insertKeys) {
        rowParams.push(`$${paramIndex++}`);

        const tablekey = key as string;

        if(this.encryptedColumns.includes(this.camelToSnakeCase(tablekey)))
          {
            params.push(this.dbEcncryption(row[key as ColumnNames<T>] as string));
            continue;
          }
        
        params.push(row[key as ColumnNames<T>]);
      }
      valueClauses.push(`(${rowParams.join(", ")})`);
    }

    const columnsList = insertKeys.map( column => this.camelToSnakeCase(column))
    .map((k) => String(k)).join(", ");
    const conflictList = this.conflictColumns.map(c => `"${String(c)}"`).join(', ');
    
    // Build DO UPDATE SET clause (using PostgreSQL EXCLUDED table pattern)
    const updateList = this.updateColumns.length > 0
      ? this.updateColumns.map((col) => `${String(col)} = EXCLUDED.${String(col)}`).join(", ")
      : insertKeys.map((col) => `${String(col)} = EXCLUDED.${String(col)}`).join(", "); // default fallback update all

    const query : string = `
      INSERT INTO ${this.tableName} (${columnsList})
      VALUES ${valueClauses.join(", ")}
      ON CONFLICT (${conflictList})
      DO UPDATE SET ${updateList} , updated_at = NOW() RETURNING *;
    `.trim();

    return {
      sql: query,
      params: params
    };
  }

  // save the table data on the database
  async  save<T>(): Promise<T[]> {

    const query =  this.build();

    const data : any = await this.execute(query);

    return this.camelizeKeys(data);
  }
}


export class DeleteQueryBuilder<T> extends Database {
  private tableName: string;
  private conditions: WhereCondition[] = [];
  private parameters: unknown[] = [];

  constructor(table: string) {
    super();
    this.tableName = table;
  }

  // Specify the WHERE clause condition and bind values safely
  where<K extends keyof T & string>(
    column: K,
    operator: ValueOperator,
    value: T[K]
  ): this {
    this.conditions.push({ column, operator, value });
    return this;
  }

  // Compile the internal state into an executable SQL string and parameters
  build(): BuiltQuery {

    const params: unknown[] = [];
    let paramIndex = 1;

    // Build WHERE clause
    const whereClauses = this.conditions.map(c => {
      params.push(c.value);
      return `${c.column} ${c.operator} $${paramIndex++}`;
    });
    
    this.parameters = params;

    let sql = `DELETE FROM ${this.tableName}`;
    
    if (this.conditions.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')} ;`;
    }
    
    return { sql, params: this.parameters };
  }

  // Execute the built query (mock execution step)
  async save(): Promise<number> {
    
    const query =  this.build();

    const data : any = await this.execute(query);

    return 1; // Return number of affected rows
  }
}



