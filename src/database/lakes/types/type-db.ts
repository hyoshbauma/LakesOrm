import type { DatabaseSchema } from "../interfaces/schema";


// Create the generic helper type
export type Table<K extends keyof DatabaseSchema> = DatabaseSchema[K];

export type RelationTable<K> = Exclude<keyof DatabaseSchema, keyof DatabaseSchema>;

// Helper type to extract column names from a table
// keyof User returns 'id' | 'email' | 'name' | 'created_at' | 'is_active'
export type ColumnNames<T> = keyof T & string;

// Helper type to get the value type of a specific column
export type ColumnType<T, K extends keyof T> = T[K];

// Types to track joined tables and compatible join columns
// This allows selecting columns from joined tables
export type JoinedTables<T, U> = T & U;

export type Nullable<T> = { [K in keyof T]: T[K] | null };

export type CompatibleColumnNames<T, V> = {
  [K in ColumnNames<T>]: T[K] extends V
    ? V extends T[K]
      ? K
      : never
    : never;
}[ColumnNames<T>];

export type defaultFn = 'uuidv7()' | 'gen_random_uuid()'| 'NOW()' | 'CURRENT_DATE' ;

// Comparison operators for WHERE clauses
export type ValueOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE'| 'IN' | 'NOT IN' | '->>' | '@>' | '->';
export type NullOperator = 'IS NULL' | 'IS NOT NULL';
export type Operator = ValueOperator | NullOperator;
export type JSONValue = string | number | boolean | null | object;
export type DataType = 'UUID'| 'SERIAL' | 'INT' | 'VARCHAR(255)' | 'TEXT' | 'DATE' | 'BOOLEAN' | 'TIMESTAMP'| 'TIMESTAMP WITH TIME ZONE' | 'JSON' | 'JSONB';
export type foreignKeyAction = 'NO ACTION' | 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';


// Relationship
export type RelationshipType = 'one' | 'many' | 'manyToMany';
