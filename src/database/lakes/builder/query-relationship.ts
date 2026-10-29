// query-builder.ts
import type { BuiltQuery, WhereCondition } from "../interfaces/structure";
import type { DatabaseSchema } from "../interfaces/schema";
import { CryptoAes256C } from "../tools/crypto";
import type { CamelizeKeys } from "../types/type-case";
import type { ColumnNames, ColumnType, JSONValue, Operator, ValueOperator } from "../types/type-db";
import { Database } from "./database";
import { belongsTo } from "../interfaces/belongto";

// The main query builder class
// T is the current table type, S is the full schema
export class QueryWithBuilder<T extends object, S extends object = DatabaseSchema> extends Database {
  protected tableName: string;
  private selectedColumns: string[] = [];
  private whereConditions: WhereCondition[] = [];
  private orderByColumns: { column: string; direction: 'ASC' | 'DESC' }[] = [];
  private limitValue: number | null = null;
  private offsetValue: number | null = null;
  private params: unknown[] = [];
  private conditions: string[] = [];
  private queries: BuiltQuery[] = [];
  private tablesRelations: string[] = [];
  private relationshipType: string[] = [];
  private foreignKeys: string[] = [];
  private tableKeys: string[] = [];
  private targets: any[] = [];

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

//   // selete also these tables
//   with(tables : BaseModel[]):this{

//     return this;
//   }

  // selete also  only this table
  withOnly(table: belongsTo<any>):this{

    const tableTwoRepository: any =  table.targetModel;

    // related rows are attached under the table name: a second relation to the same table would replace the first
    if (this.tablesRelations.includes(tableTwoRepository.tableName)) {
      throw new Error(`withOnly() already loads ${tableTwoRepository.tableName}: one relation per related table`);
    }

    // push the relation table
    this.tablesRelations.push(tableTwoRepository.tableName)

    // push the foreign key
    this.foreignKeys.push(table.foreignKey);

    // push the foreign key
    this.tableKeys.push(table.tableKey ?? 'id');

    // keep the related model: it loads its own rows
    this.targets.push(tableTwoRepository);
    // push the relationship type (one , one to may)
    this.relationshipType.push(table.type);

     
    // sql BuiltQuery for this 
    let sql : BuiltQuery = 
    { 
        sql: `SELECT * FROM ${tableTwoRepository.tableName} WHERE ${this.camelToSnakeCase(table.foreignKey)} IN  `,
        params: []
    };

    this.queries.push(sql);

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

  whereIn<K extends ColumnNames<T>>(column: K, values: ColumnType<T, K>[]):this{
    // in operator
    const paramKey = this.params.length+1;

    let sqlValue : string = '';
    // get the last element index
    const lastValue : number = values.length - 1;

    // loop into the values
    for (let index = 0; index < values.length; index++) {
      // const element = values[index];
      // check if is last element
      if(lastValue == index){
        //without commer if it is the last element
        sqlValue += `$${index + paramKey} `;
        continue;
      }
      // set the commer
      sqlValue += `$${index + paramKey} , `;
    }

    // Converts columns values
    this.conditions.push(
      `${column} IN ( ${sqlValue} )`
    );

     // global params
    this.params.push(...values);

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
  build(): BuiltQuery[] {
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


    // WHERE clause
    if (this.whereConditions.length > 0) {
      // check condition
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

    const tablesSqls : BuiltQuery[]  =  [{
      sql: parts.join(''),
      params: this.params.filter(p => p !== undefined)
    }];

    tablesSqls.push(...this.queries);


    return tablesSqls;
  }

  

  // get all the data from the query
  async get(): Promise<any>
  {
    const queries =  this.build();

    let responseOne: any[]  = await this.camelizeList(await  this.execute(queries[0]));

    // no relation asked or no parent found: nothing to attach
    if (this.targets.length === 0 || responseOne.length === 0) {
      return responseOne;
    }

    // loop in the relations
    for (let relation = 0; relation < this.targets.length; relation++) {
        // set the whenIn query
        const query : BuiltQuery = {
            sql: queries[1].sql + `( ${sqlValue} )`,
            params: idsList
        }
        // execute the sql
        let responseTwo: any[] = await this.camelizeList(await this.execute(query));

        // initial complex variable
        let data: any[] = []; 
        // loop in the parent and set child
        for (let index = 0; index < responseOne.length; index++) {
          
          // get the parent element
          let element = responseOne[index];

          // check all child that belong to the parent
          const result = responseTwo.filter((item) => element[this.tableKeys[0]] == item[this.foreignKeys[0]]);

          // check if relationship is one to one
          if(this.relationshipType[0].toLocaleLowerCase() == 'one')
          {
            // get only the first element
            element[this.tablesRelations[0]] = result[0];
            
          }else{

            // get only the first element
            element[this.tablesRelations[0]] = result;
          }

          
          // add the parent in the list
          data.push(element);
          
        }

      const foreignKey: string = this.foreignKeys[relation];

      // the column of this table the foreign key points at: id unless tableKey says otherwise
      const tableKey: string = this.tableKeys[relation];

      // Use the map() method to iterate over the list and return a new array of just the keys.
      const keysList: unknown[] = responseOne.map(item => item[tableKey]);

      if (keysList.some(key => key === undefined)) {
        throw new Error(`withOnly() needs the ${tableKey} column of the parent table to be selected`);
      }

      // the related model loads its own rows, with its own column casing and decryption
      const responseTwo: any[] = await this.targets[relation].fromQuery()
        .whereIn(this.camelToSnakeCase(foreignKey), keysList)
        .get();

      // loop in the parent and set child
      for (let index = 0; index < responseOne.length; index++) {

        // get the parent element
        let element = responseOne[index];

        // check all child that belong to the parent
        element[this.tablesRelations[relation]] = responseTwo.filter((item) => element[tableKey] == item[foreignKey]);
      }
    }

    return responseOne;
  }
}