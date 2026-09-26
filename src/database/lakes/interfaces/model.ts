// Database-specific interfaces (e.g. PostgreSQL)
export interface PostgreSQLAdapter {
  query<T>(sql: string, params?: any[]): Promise<T[]>;
}

// Base model interface
export interface Model{
  id?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Object Adapter interface (customizable conversion)
export interface ObjectAdapter {
  hydrate<T>(row: Record<string, any>): T;
  dehydrate<T>(obj: T): Record<string, any>;
}

// Hydration configuration
export interface HydrationConfig {
  adapter?: ObjectAdapter;
  exclude?: string[]; // Exclude fields from hydration
  transform?: (row: Record<string, any>) => Record<string, any>;
}
