import type { BaseModel } from "../models/model";
import { type foreignKeyAction, type ColumnNames, type DataType, type Operator, type Table, type RelationshipType } from "../types/type-db";
import type { DatabaseSchema } from "./schema";


// Represents a built query ready for execution
export interface BuiltQuery {
  sql: string;
  params: unknown[];
}

export interface foreignKey {
  table:  (keyof DatabaseSchema);
  column:  string;
  onDelete?: foreignKeyAction, 
  onUpdate?: foreignKeyAction;
}

export interface ColumnType {
  name: string;
  type: DataType;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  defaultValue?: string | number ;
  references?: foreignKey;
  isGenerated?: {
    dependsOn : string[],
    expression : string
  }
}

export interface IndexDefinition<T> {
  name: string;
  columns: ColumnNames<T>[];
}

// A condition in a WHERE clause
export interface WhereCondition {
  column: string;
  operator: Operator;
  value?: unknown;
}

// Example: Building a search query with optional filters
export interface SearchFilters {
  email?: string;
  isActive?: boolean;
  sortBy?: 'name' | 'created_at';
  sortOrder?: 'ASC' | 'DESC';
  page?: number;
}

//
export interface DatabaseJson 
{
    name : string;
    tables: TableSchema[]
    tableCount: number;
    migration : string[];
}

export interface TableSchema
{
    name: string;
    class: string;
    migration: string;
}

export interface DateTimeLakes {
    yeah: number;
    month: string;
    day: string;
    hours:string;
    minutes: string;
    seconds: string;
}


/** Defines the structure of the data being updated in the target table. */
export interface UpdateSet {
    [column: string]: any; // e.g., { status: 'active', last_updated: new Date() }
}

/** Defines the relationship between the target and source tables. */
export interface JoinCondition {
    targetTable: string; // e.g., 'users'
    sourceTable: string; // e.g., 'audit_logs'
    onCondition: string; // The column used to link them (e.g., 'user_id')
    sourceField: string; // The column whose value will be used for the update (e.g., 'status')
}

/** Defines the parameters passed to the final SQL query. */
export interface UpdateJoinParams {
    updates: UpdateSet;
    join: JoinCondition;
    where?: string; // Optional secondary WHERE clause
}