// query-builder.ts
import type { BuiltQuery, WhereCondition } from "../interfaces/structure";
import type { DatabaseSchema } from "../interfaces/schema";
import { CryptoAes256C } from "../tools/crypto";
import type { CamelizeKeys } from "../types/type-case";
import type { ColumnNames, ColumnType, JSONValue, Operator, ValueOperator } from "../types/type-db";
import { Database } from "./database";

// The main query builder class
// T is the current table type, S is the full schema
export class QueryBuilder<T extends object, S extends object = DatabaseSchema> extends Database {
  protected tableName: string;
  private selectedColumns: string[] = [];
  private whereConditions: WhereCondition[] = [];
  private orderByColumns: { column: string; direction: 'ASC' | 'DESC' }[] = [];
  private limitValue: number | null = null;
  private offsetValue: number | null = null;
  protected joins: string[] = [];
  private params: unknown[] = [];
  private conditions: string[] = [];

  constructor(table: string, encryptedColumns: string[]  = []) {
    super()
    this.tableName = this.camelToSnakeCase(table);
    this.encryptedColumns = encryptedColumns.map( columnKey => this.camelToSnakeCase(columnKey));
  }

  // Select specific columns with full type safety
  // Only allows columns that exist on the table type T
  select<K extends ColumnNames<T>>(...columns: K[]): this {
    this.selectedColumns.push(...columns);
    return this;
  }

  // Select all columns
  selectAll(): this {
    this.selectedColumns = ['*'];
    return this;
  }

  // Add a WHERE condition with type-safe column and value
  // where<K extends ColumnNames<T>>(
  //   column: K,
  //   operator: NullOperator
  // ): this;
  where<K extends ColumnNames<T>>(
    column: K,
    operator: ValueOperator,
    value: ColumnType<T, K>
  ): this;
  where<K extends ColumnNames<T>>(
    column: K,
    operator: Operator,
    value?: ColumnType<T, K>
  ): this {
    this.whereConditions.push({ column, operator, value });
    if (operator !== 'IS NULL' && operator !== 'IS NOT NULL') {
      this.params.push(value);
    }
    return this;
  }

  whereIn<K extends ColumnNames<T>>(column: K, value: ColumnType<T, K>[]):this{
    // in operator
    const operator : Operator =  'IN';

    this.whereConditions.push({ column, operator, value });
    this.params.push(value);
    return this;
  }

  // Where a jsonb key contains a value (using @> containment operator)
  whereJsonContains<K extends ColumnNames<T>>(path: K, value: JSONValue): this {
    const paramKey = `$${this.params.length+1}`;
    // Converts path like "metadata" and checks containment
    this.conditions.push(
      `${path} @> ${paramKey}::jsonb`
    );
    this.params.push(JSON.stringify(value));
    return this;
  }

  // Where a nested jsonb property equals a text/number value (using ->>)
  whereJsonEquals<K extends ColumnNames<T>>(column: K, jsonPath: string[], value: JSONValue): this {
    const paramKey = `$${this.params.length+1}`;
    const accessor = jsonPath.reduce((acc, key, idx) => {
      const op = idx === jsonPath.length - 1 ? '->>' : '->';
      return `${acc} ${op} '${key}'`;
    }, column);

    this.conditions.push(`${accessor} = ${paramKey}`);
    this.params.push(value);
    return this;
  }

  // Convenience method for equality comparison
  whereEquals<K extends ColumnNames<T>>(
    column: K,
    value: ColumnType<T, K>
  ): this {
    return this.where(column, '=', value);
  }

  // Add ordering with type-safe column names
  orderBy<K extends ColumnNames<T>>(
    column: K,
    direction: 'ASC' | 'DESC' = 'ASC'
  ): this {
    this.orderByColumns.push({ column, direction });
    return this;
  }

  // Limit results
  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  // Offset for pagination
  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  // Build the final SQL query
  build(): BuiltQuery {
    const parts: string[] = [];

    // SELECT clause
    let columns = this.selectedColumns.length > 0
      ? this.selectedColumns.join(', ')
      : '*';

    // refactor column name in snake-case 
    columns = this.camelToSnakeCase(columns);

    parts.push(`SELECT ${columns}`);

    // FROM clause
    parts.push(` FROM ${this.tableName}`);

    // JOIN clauses
    if (this.joins.length > 0) {
      parts.push(this.joins.join(' '));
    }

    // WHERE clause
    if (this.whereConditions.length > 0) {
      const conditions = this.whereConditions.map((c, i) => {

        // refactor column name in snake-case 
        c.column = this.camelToSnakeCase(c.column);

        if (c.operator === 'IS NULL' || c.operator === 'IS NOT NULL') {
          return `${c.column} ${c.operator}`;
        }

        return `${c.column} ${c.operator} $${i + 1}`;
      });

      parts.push(` WHERE ${conditions.join(' AND ')}`);
    }

    // check if JSON check exist
    if(this.conditions.length){
      // check if whereCondition has been set
      const checkJson = this.whereConditions.length > 0 ? 'AND' : ' WHERE'
      // set the where JSON sql
      const whereClause = this.conditions.length > 0 ? ` ${checkJson} ${this.conditions.join(' AND ')}` : '';

      parts.push(whereClause);
    }

    // ORDER BY clause
    if (this.orderByColumns.length > 0) {
      const orderParts = this.orderByColumns.map(
        // refactor column name in snake-case 
        o => `${this.camelToSnakeCase(o.column)} ${o.direction}`
      );
      parts.push(` ORDER BY ${orderParts.join(', ')}`);
    }

    // LIMIT clause
    if (this.limitValue !== null) {
      parts.push(` LIMIT ${this.limitValue}`);
    }

    // OFFSET clause
    if (this.offsetValue !== null) {
      parts.push(` OFFSET ${this.offsetValue}`);
    }

    return {
      sql: parts.join(''),
      params: this.params.filter(p => p !== undefined)
    };
  }

  /**
   * Transforms the QueryBuilder into a COUNT operation.
   * Modifies the generic token to change downstream execution return types.
   */
  async count(): Promise<number> {
    const parts: string[] = [];

    // SELECT clause
    let columns = this.selectedColumns.length > 0
      ? this.selectedColumns.join(', ')
      : '*';

    // refactor column name in snake-case 
    columns = this.camelToSnakeCase(columns);
    
    parts.push(`SELECT COUNT(*)`);

    // FROM clause
    parts.push(` FROM ${this.tableName}`);

    // JOIN clauses
    if (this.joins.length > 0) {
      parts.push(this.joins.join(' '));
    }

    // WHERE clause
    if (this.whereConditions.length > 0) {
      const conditions = this.whereConditions.map((c, i) => {

        // refactor column name in snake-case 
        c.column = this.camelToSnakeCase(c.column);

        if (c.operator === 'IS NULL' || c.operator === 'IS NOT NULL') {
          return `${c.column} ${c.operator}`;
        }

        return `${c.column} ${c.operator} $${i + 1}`;
      });
      parts.push(` WHERE ${conditions.join(' AND ')}`);
    }

    const query : BuiltQuery =  {
      sql: parts.join(''),
      params: this.params.filter(p => p !== undefined)
    };

    // { count: "5" }
    const data : any =  await this.executeOne(query);

    return  data.count;
  }

  // get all the data from the query
  async getRows(): Promise<T[]>
  {
    const query =  this.build();

    return this.execute(query);
  }

  // get all the data from the query
  async get(): Promise<T[]>
  {
    const query =  this.build();

    const data : T[]  = await this.camelizeList(await this.execute(query));

    return data;
  }

  // get only the first data
  async find(): Promise<CamelizeKeys<T> | null >
  {
    const query =  this.build();

    const data : any = await this.executeOne(query);

    if(data == null)
    {
      return null;
    }

    return this.camelizeKeys(data);
  }
}