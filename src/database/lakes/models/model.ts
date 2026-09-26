import { Injectable, Singleton } from "../../../../container";
import type { AbstractTableSchema } from "../abstracts/tables";
import { CreateBuilder, DeleteQueryBuilder, InsertBuilder, UpdateBuilder, UpsertQueryBuilder } from "../builder/query-mutations";
import { QueryBuilder } from "../builder/query-builder";
import { JoinableQueryBuilder } from "../builder/query-joins";
import { AlterTableBuilder, CreateTableBuilder, DeleteTableBuilder } from "../builder/query-structure";
import type { DatabaseSchema } from "../interfaces/schema";
import type { ColumnNames } from "../types/type-db";
import type { Relationship, WhereCondition } from "../interfaces/structure";


/*
  * Apps Table 
  */
  export abstract class BaseModel<T extends object = DatabaseSchema>{
    
    protected tableName: string;
    // column to encrypt
    protected encryptedColumns: ColumnNames<T>[] = [];
    // column to hide
    protected hidden : ColumnNames<T>[] = [];

    // protected table: T ;

    constructor(tableName: string) {

        // this.table = ;
        this.tableName = tableName;
    }

    /**
    * Create a TABLE
    */
    createTable(): CreateTableBuilder<T> {
      return new CreateTableBuilder<T>(this.tableName);
    }

     /**
    * Create a TABLE
    */
    alterTable(): AlterTableBuilder<T> {
      return new AlterTableBuilder<T>(this.tableName);
    }

    /**
     *  Delete a TABLE
     **/
    dropTable(): DeleteTableBuilder<T> {
      return new DeleteTableBuilder<T>(this.tableName);
    }

    /**
      * Create or Insert one value
     **/
    createQuery(): CreateBuilder<T> {
      return new CreateBuilder<T>(this.tableName, this.encryptedColumns);
    }

    /**
     * Select from table
    */
    fromQuery(): QueryBuilder<T> {
      return new QueryBuilder<T>(this.tableName, this.encryptedColumns);
    }
    
    /**
     * Select Join from table
    */
    selectJoinQuery(): JoinableQueryBuilder<T> {
      return new JoinableQueryBuilder<T>(this.tableName, this.encryptedColumns);
    }

    /**
     *  Insert in to the table
     **/
    insertQuery(): InsertBuilder<T> {
      return new InsertBuilder<T>(this.tableName, this.encryptedColumns);
    }
    
    /**
     *  update in to the table
     **/
    updateQuery(): UpdateBuilder<T> {
      return new UpdateBuilder<T>(this.tableName, this.encryptedColumns);
    }

    /**
    *  up set in to the table
    **/
    upsetQuery(): UpsertQueryBuilder<T> {
      return new UpsertQueryBuilder<T>(this.tableName, this.encryptedColumns);
    }

    /**
    *  up set in to the table
    **/
    deleteQuery(): DeleteQueryBuilder<T> {
      return new DeleteQueryBuilder<T>(this.tableName);
    }

    // Wrapped find method that returns rich instances
    // protected async findMany(whereClause?: Partial<M>): Promise<M[]> {
    //     const data = ;
        
    //     // Convert plain database rows into Model instances
    //     return (this.modelClass as any).hydrate(rawRows);
    // }

    private isDateKey<T>(obj: T, key: keyof T): boolean {
        // Check if the property value is an instance of the Date object
        return obj[key] instanceof Date;
    }

    // insert date into the db
    async create(instance : T)
    {
        // Leverage the query builder under the hood
        const row: any = await this.createQuery().values(instance)
        .save();

        return row;
    }

    // insert date into the db
    async insert(instances : T[])
    {
        // Leverage the query builder under the hood
        const row: any = await this.insertQuery().values(instances)
        .save();

        return row;
    }

    // insert date into the db
    async upsert(instances : T[], conflict: ColumnNames<T>[], doUpdateSet: ColumnNames<T>[] )
    {
        // Leverage the query builder under the hood
        const row: any = await this.upsetQuery()
        .values(instances)
        .conflictOn(...conflict)
        .doUpdateSet(...doUpdateSet)
        .save();

        return row;
    }

    /**
     * READ (Find By Filter): Abstracts query building and returns typed items
     */
    async find(field: ColumnNames<T>, value: any, fieldsToSelect: ColumnNames<T>[] = []): Promise<T | null> {
        
        // Leverage the query builder under the hood
        const row: any = await this.fromQuery()
        .select(...fieldsToSelect)
        .selectAll()
        .whereEquals(field, value)
        .find();



        // Map raw rows into final domain entities
        // const data : T[] =   Hydrator.hydrateMany<T>([row], {
        //     idKey: 'id',
        //     relationKey: 'posts',
        //     relationIdKey: 'posts_id'
        //     });

        return row;
    }

    /**
     * READ (Find By Filter): Abstracts query building and returns typed items
     */
    async findWhere(field: ColumnNames<T>, value: any, fieldsToSelect: ColumnNames<T>[] = []): Promise<T[]> {
        
        // Leverage the query builder under the hood
        const rawRows = await this.fromQuery()
        .select(...fieldsToSelect)
        .whereEquals(field, value)
        .get();

        // Map raw rows into final domain entities
        // const data : T[] =  Hydrator.hydrateMany<T>(rawRows, {
        //     idKey: 'id',
        //     relationKey: 'posts',
        //     relationIdKey: 'posts_id'
        //     });

        return rawRows as T[];
    }

    /**
     * READ (Find By Filter): Abstracts query building and returns typed items
     */
    async getAll(fieldsToSelect: ColumnNames<T>[] = []): Promise<T[]> {
        
        // Leverage the query builder under the hood
        const rawRows = await this.fromQuery()
        .select(...fieldsToSelect)
        .get();

        // Map raw rows into final domain entities
        // const data : T[] =  Hydrator.hydrateMany<T>(rawRows, {
        //     idKey: 'id',
        //     relationKey: 'posts',
        //     relationIdKey: 'posts_id'
        //     });

        return rawRows as T[];
    }

    // Specialized method for relationship loading
    async findWithRelationships(relation: Relationship, condition: WhereCondition): Promise<T[]> {
      
      // const relationNames = relations.filter(r => r.startsWith('author')); // Extract desired relations

      // 1. Fetch the main posts (e.g., SELECT * FROM posts)
      const tableOneDatas = await this.fromQuery().
      selectAll()
      // .where(condition.column as ColumnNames<T>, condition.operator,condition.value);
      .get();

      if (tableOneDatas.length === 0) {
        return [];
      }

      const defaultKey: string = relation.foreignKey ?? relation.targetModel +'_id';

      const tableTwoRepository = relation.Reppository;

      // // 2. Identify all unique author IDs needed (e.g., {1, 5, 1, 8})
      const tableDataIds = [...new Set(tableOneDatas.map(p => p[defaultKey as keyof T]))];

      // // 3. Fetch the related authors in one batch (e.g., SELECT * FROM users WHERE id IN (1, 5, 8))
      // const tableTwoDatas = await tableTwoRepository.fromQuery().select().whereIn('id', tableDataIds);
      
      // const authors = await query(`SELECT * FROM users WHERE id IN (${tableDataIds.join(',')})`);

      // const authorMap = new Map(tableTwoDatas.map(u => [u.id, u]));

      // // 4. Hydrate the relationship
      // const hydratedPosts = posts.map(post => {
      //   const author = authorMap.get(post.authorId);
        
      //   // Attach the resolved 'one' object to the 'many' Post object
      //   if (author) {
      //     // Accessing the result via the Post model's defined accessor
      //     (post as any).getAuthor = () => author; 
      //     // NOTE: A better ORM would dynamically set properties or use a separate DTO.
      //   }
      //   return post;
      // });

      const hydratedPosts : T[] = [];

      return hydratedPosts;
    }

    // Save changes on an instance back to the database
    // protected async save(instance: T): Promise<void> {
        // if (instance.id as keyof T) {
        // console.log(`Updating table ${this.tableName} where ID = ${instance.id}`);
        // } else {
        // console.log(`Inserting new record into table ${this.tableName}`);
        // }
    // }

    /**
     * Hydration Layer: Converts raw database objects into correct types
     */
    // private hydrate(row: any): T {
    //     const entity = {} as any;
    //     for (const key of Object.keys()) {
    //         const value = row[key];
    //         if (this.isDateKey(this.table, key as keyof T)) {
    //             entity[key] = new Date(value); // Ensure Date strings become actual Date objects
    //         } else {
    //             entity[key] = value;
    //         }
    //     }
    //     return entity as T;
    // }
    
    
  } 