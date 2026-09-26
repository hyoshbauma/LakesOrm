import { lakesTableMigrationPath } from "./lakes/tools/location";

interface MigrationPath { 
    path : string,
    referencesPath: string
    
}

// set ORM table and Migration Paths
export type OrmPath = MigrationPath[];

// Register Table & Migration Path
export const ormPaths : OrmPath = [
    // default paths
    {path : lakesTableMigrationPath, referencesPath: ''}
]


