import { Injectable } from "../../../../container";

type Tuple<T extends string, D extends string> = T extends `${infer F}${D}${infer R}` 
  ? [F, ...Tuple<R, D>] 
  : [T];

type NestedObj<T extends string[], V> = T extends [infer F extends string, ...infer R extends string[]]
  ? { [K in F]: R['length'] extends 0 ? V : NestedObj<R, V> }
  : never;

// Generic type to represent any flat row from the database
export type FlatRow = Record<string, any>;


@Injectable()
export class Hydrator {
  /**
   * Transforms a single flat database row into a nested object structure.
   */
  static nestRow<T = any>(row: FlatRow, delimiter: string = '_'): T {
    const result: any = {};

    for (const [key, value] of Object.entries(row)) {
      if (value === null || value === undefined) continue;

      const parts = key.split(delimiter);
      let current = result;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]!;
        
        if (i === parts.length - 1) {
          current[part] = value;
        } else {
          current[part] = current[part] || {};
          current = current[part];
        }
      }
    }

    return result as T;
  }

  /**
   * Hydrates an array of flat rows into a nested collection, 
   * grouping one-to-many relations by a primary key.
   */
  static hydrateMany<T = any>(
    rows: FlatRow[],
    config: {
      idKey: string;          // The flat key used as the primary identity (e.g., 'id')
      relationKey: string;    // The nested collection key to push items into (e.g., 'comments')
      relationIdKey: string;  // The flat key for the relation identity (e.g., 'comment_id')
      delimiter?: string;
    }
  ): T[] {
    const { idKey, relationKey, relationIdKey, delimiter = '_' } = config;
    const cache = new Map<any, any>();

    for (const row of rows) {
      const primaryId = row[idKey];
      if (!primaryId) continue;

      // 1. Separate parent fields from child fields
      const parentRow: FlatRow = {};
      const childRow: FlatRow = {};

      for (const [key, value] of Object.entries(row)) {
        if (key.startsWith(relationKey + delimiter)) {
          // Strip the prefix for the child object structure
          const cleanKey = key.slice((relationKey + delimiter).length);
          childRow[cleanKey] = value;
        } else {
          parentRow[key] = value;
        }
      }

      // 2. Fetch or create the nested parent item
      if (!cache.has(primaryId)) {
        const nestedParent = this.nestRow(parentRow, delimiter);
        nestedParent[relationKey] = [];
        cache.set(primaryId, nestedParent);
      }

      const currentParent = cache.get(primaryId);

      // 3. Add the child item if it exists and isn't a duplicate
      if (row[relationIdKey] !== null && row[relationIdKey] !== undefined) {
        const nestedChild = this.nestRow(childRow, delimiter);
        
        // Simple deduplication check for the child collection
        const childIdFieldName = relationIdKey.split(delimiter).pop() || 'id';
        const alreadyExists = currentParent[relationKey].some(
          (child: any) => child[childIdFieldName] === nestedChild[childIdFieldName]
        );

        if (!alreadyExists) {
          currentParent[relationKey].push(nestedChild);
        }
      }
    }

    return Array.from(cache.values());
  }
}
