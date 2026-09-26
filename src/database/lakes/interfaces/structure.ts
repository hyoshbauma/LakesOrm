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

export interface Relationship {
  type: RelationshipType; // e.g., 'one', 'many'
  targetModel: keyof DatabaseSchema;    // The name/class of the related model
  foreignKey?: string;    // The actual database foreign key column name
  isInverse?: boolean;    // True if this relationship is the "many" side of a 1:N link
  Reppository: BaseModel;    // True if this relationship is the "many" side of a 1:N link
}