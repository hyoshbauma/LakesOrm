

// import type { DatabaseSchema } from "../interfaces/schema";

export abstract class AbstractMigration<T> {
  // Enforce schema tracking in every migration file
//   protected abstract schema: DatabaseSchema;

  // Made abstract so child classes MUST implement the logic
  public abstract up(): Promise<T | null>;
  
  // Returns T on success, or null if the rollback is destructive/unsupported
  public abstract down(): Promise<T | null>;
}
