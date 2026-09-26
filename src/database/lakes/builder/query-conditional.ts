// conditional.ts
import type { ColumnNames, ColumnType, ValueOperator } from "../types/type-db";
import { JoinableQueryBuilder } from "./query-joins";

// Extend query builder with conditional methods
export class ConditionalQueryBuilder<T extends object> extends JoinableQueryBuilder<T> {

  // Only add WHERE clause if condition is true
  whereIf<K extends ColumnNames<T>>(
    condition: boolean,
    column: K,
    operator: ValueOperator,
    value: ColumnType<T, K>
  ): this {
    if (condition) {
      return this.where(column, operator, value);
    }
    return this;
  }

  // Only add ORDER BY if condition is true
  orderByIf<K extends ColumnNames<T>>(
    condition: boolean,
    column: K,
    direction: 'ASC' | 'DESC' = 'ASC'
  ): this {
    if (condition) {
      return this.orderBy(column, direction);
    }
    return this;
  }

  // Add pagination helpers
  paginate(page: number, pageSize: number): this {
    return this
      .limit(pageSize)
      .offset((page - 1) * pageSize);
  }
}

