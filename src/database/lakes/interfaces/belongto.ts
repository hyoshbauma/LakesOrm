import { BaseModel } from "../models/model";
import { ColumnNames, RelationshipType } from "../types/type-db";
import { DatabaseSchema } from "./schema";

// export interface Relationship {
export interface belongsTo{
  type: RelationshipType; // e.g., 'one', 'many'
//   targetModel: keyof DatabaseSchema;    // The name/class of the related model
  foreignKey: string;    // The actual database foreign key column name
  isInverse?: boolean;    // True if this relationship is the "many" side of a 1:N link
  targetModel : Object;    // The name/class of the related model
  tableKey? : string
}