

// 1. Type-level transformation using Template Literal Types
export type SnakeToCamel<S extends string> = S extends `${infer T}_${infer U}`
  ? `${T}${Capitalize<SnakeToCamel<U>>}`
  : S;


// Recursive type mapper for objects and arrays
// use in the database
export type CamelizeKeys<T> = T extends Date
  ? T
  : T extends Array<infer U>
  ? Array<CamelizeKeys<U>>
  : T extends object
  ? { [K in keyof T as SnakeToCamel<K & string>]: CamelizeKeys<T[K]> }
  : T;



// // 1. Convert an individual string literal type
// export type CamelToSnakeCase<S extends string> = S extends `${infer T}${infer U}`
//   ? `${T extends Capitalize<T> ? "_" : ""}${Lowercase<T>}${CamelToSnakeCase<U>}`
//   : S;

// // 2. Map an entire object interface to snake_case keys
// export type SnakeCaseKeys<T extends object> = {
//   [K in keyof T as CamelToSnakeCase<K & string>]: T[K];
// };

// // Example usage:
// // interface UserProfile {
// //   userId: number;
// //   firstName: string;
// //   isAccountActive: boolean;
// // }

// // // Strictly typed as: { user_id: number; first_name: string; is_account_active: boolean; }
// // type SnakeUserProfile = SnakeCaseKeys<UserProfile>;


// // 1. Type-level transformation using Template Literal Types
// type SnakeToCamelCase<S extends string> = S extends `${infer T}_${infer U}`
//   ? `${T}${Capitalize<SnakeToCamelCase<U>>}`
//   : S;

// // Recursive type mapper for objects and arrays
// export type Camelize<T> = T extends Array<infer U>
//   ? Array<Camelize<U>>
//   : T extends Record<string, any>
//   ? { [K in keyof T as SnakeToCamelCase<string & K>]: Camelize<T[K]> }
//   : T;

// // 2. Runtime JavaScript function
// export function snakeToCamelCase(str: string): string {
//   return str.replace(/(_\w)/g, (match) => match[1].toUpperCase());
// }

// // 3. Deep object transformer combining runtime and types
// export function camelize<T>(obj: T): Camelize<T> {
//   if (Array.isArray(obj)) {
//     return obj.map((v) => camelize(v)) as any;
//   } else if (obj !== null && typeof obj === 'object') {
//     return Object.keys(obj).reduce((result, key) => {
//       const camelKey = snakeToCamelCase(key);
//       result[camelKey] = camelize((obj as any)[key]);
//       return result;
//     }, {} as any);
//   }
//   return obj as any;
// }