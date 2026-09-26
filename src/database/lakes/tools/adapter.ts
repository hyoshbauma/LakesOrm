import type { HydrationConfig, Model, ObjectAdapter, PostgreSQLAdapter } from "../interfaces/model";

// ----------------------
// 1. OBJECT ADAPTER
// ----------------------

// Custom adapter that handles camelCase → snake_case conversion
class CamelCaseAdapter implements ObjectAdapter {
  hydrate(row: Record<string, any>): any {
    // Convert DB columns (snake_case) → TS properties (camelCase)
    const result: any = {};
    for (const [key, value] of Object.entries(row)) {
      const camelKey = this.toCamelCase(key);
      result[camelKey] = value;
    }
    return result;
  }

  dehydrate(obj: any): Record<string, any> {
    // Convert TS properties → DB columns (snake_case)
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = this.toSnakeCase(key);
      result[snakeKey] = value;
    }
    return result;
  }

  private toCamelCase(str: string): string {
    return str.replace(/(_|\-)/g, ' ').replace(/\b(\w)/g, (m) => m.toUpperCase()).replace(/\s/g, '');
  }

  private toSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`).replace(/^_/, '');
  }
}

// ----------------------
// 2. HYDRATION ENGINE
// ----------------------

class Hydrator {
  private config: HydrationConfig = { adapter: new CamelCaseAdapter() };

  hydrate<T extends Model>(rows: any[], model: T): T[] {
    return rows.map(row => this.config.adapter!.hydrate(row) as T);
  }

  // For custom hydration (e.g. date formatting)
  withCustomTransformer<T extends Model>(transformer: (row: any) => any) {
    this.config.transform = transformer;
    return this;
  }
}

// ----------------------
// 3. MODEL DEFINITION
// ----------------------

class User implements Model {
  id!: number;
  createdAt!: Date;
  updatedAt!: Date;
  name!: string;
  email!: string;
  // ... other fields
}
