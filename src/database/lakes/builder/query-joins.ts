// joins.ts
import type { DatabaseSchema } from "../interfaces/schema";
import type { ColumnNames, ColumnType, CompatibleColumnNames, JoinedTables, Nullable } from "../types/type-db";
import { QueryBuilder } from "./query-builder";



// Extended query builder with join support
export class JoinableQueryBuilder<T extends object, S extends object = DatabaseSchema>
  extends QueryBuilder<T, S> {

  // Inner join with type safety
  // Returns a new builder that knows about both tables
  innerJoin<K extends keyof S, L extends ColumnNames<T>>(
    table: K,
    leftColumn: L,
    rightColumn: CompatibleColumnNames<S[K], ColumnType<T, L>>
  ): JoinableQueryBuilder<JoinedTables<T, S[K]>, S> {
    const joinSql = `INNER JOIN ${String(table)} ON ${this.tableName}.${leftColumn} = ${String(table)}.${rightColumn}`;
    this.addJoin(joinSql);

    // Cast to the new type that includes both tables
    return this as unknown as JoinableQueryBuilder<JoinedTables<T, S[K]>, S>;
  }

  // Left join preserves all rows from left table
  leftJoin<K extends keyof S, L extends ColumnNames<T>>(
    table: K,
    leftColumn: L,
    rightColumn: CompatibleColumnNames<S[K], ColumnType<T, L>>
  ): JoinableQueryBuilder<JoinedTables<T, Nullable<S[K]>>, S> {
    const joinSql = `LEFT JOIN ${String(table)} ON ${this.tableName}.${leftColumn} = ${String(table)}.${rightColumn}`;
    this.addJoin(joinSql);

    // Nullable because left join may return null values for the joined table
    return this as unknown as JoinableQueryBuilder<JoinedTables<T, Nullable<S[K]>>, S>;
  }

  private addJoin(sql: string): void {
    this.joins.push(sql);
  }
}

// Factory that returns joinable query builder
// export function query<K extends keyof DatabaseSchema>(
//   table: K
// ): JoinableQueryBuilder<DatabaseSchema[K]> {
//   return new JoinableQueryBuilder<DatabaseSchema[K]>(table);
// }

// Example: Join posts with users
// const postsWithAuthors = query('posts')
//   .innerJoin('users', 'author_id', 'id')
//   .select('title', 'content', 'name', 'email')  // Can select from both tables
//   .whereEquals('is_active', true)  // Filter on joined table
//   .build();