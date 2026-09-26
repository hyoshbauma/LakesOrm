import * as crypto from 'crypto';
import * as path from 'path';
import { readdir } from "node:fs/promises";
import type { Migration, MigrationContext, MigrationRecord, MigrationResult } from './interfaces/migration.';
import { Database } from './builder/database';
import { lakesTableMigrationPath, lakesMigrationsPath } from './tools/location';
import { Injectable, Singleton } from '../../../container';
import { ormPaths, type OrmPath } from '../path-registry';
import console from 'node:console';

// @Singleton
@Injectable()
export class MigrationService extends Database {
  private migrationsPaths: OrmPath;
  private tableName: string;

  constructor(
  //   options: {
  //   connectionString: string;
  //   migrationsPath: string;
  //   tableName?: string;
  // }
) {
    super();
    // this.migrationsPath = options.migrationsPath;
    this.migrationsPaths = ormPaths;
    // this.tableName = options.tableName || 'schema_migrations';
    this.tableName = 'schema_migrations';
  }

  // Initialize migration tracking table
  async initialize(): Promise<void> {
    
    // console.log('creating the migration table');
    
    await this.lakesOrm.db.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        timestamp BIGINT NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        checksum VARCHAR(64) NOT NULL
      )
    `);

    // console.log('creating the migration lock table');

    // Create lock table for preventing concurrent migrations
    await this.lakesOrm.db.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName}_lock (
        id INTEGER PRIMARY KEY DEFAULT 1,
        locked_at TIMESTAMP WITH TIME ZONE,
        locked_by VARCHAR(255),
        CONSTRAINT single_row CHECK (id = 1)
      )
    `);

    // console.log('Inserting the the migration lock table');

    await this.lakesOrm.db.query(`
      INSERT INTO ${this.tableName}_lock (id) VALUES (1)
      ON CONFLICT DO NOTHING
    `);
  }

  // Wrapper function to process multiple migration folders
  async loadMigrations() : Promise<Migration[]> {

    let migrationsAll: Migration[] = [];

    for (let index = 0; index < this.migrationsPaths.length; index++) {

      // get the paths
      const migrationPath = this.migrationsPaths[index]!.path;
      const referencesPath = this.migrationsPaths[index]!.referencesPath;
      // get the migration from the folder
      const migrations: Migration[] =  await this.loadMigrationsPath(migrationPath+'/migration', referencesPath+'/migration');
      // inset all the data
      migrationsAll.push(...migrations);
      
    }

    return migrationsAll.sort((a, b) => a.timestamp - b.timestamp);
  }

  // Load all migration files
  private async loadMigrationsPath(migrationsPath: string, referencesPath: string): Promise<Migration[]> {

    migrationsPath = referencesPath = path.resolve(process.cwd(), migrationsPath);

    const files = await readdir(migrationsPath);
    const migrationFiles = files
      .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
      .sort();

    const migrations: Migration[] = [];


    for (const file of migrationFiles) { 
      // get the file path
      let filePath =  path.join(referencesPath, file);
      // check if the file is in ORM's default folder
      filePath =  migrationsPath.includes(lakesTableMigrationPath) ?  '.'+filePath : filePath;
      // import the file
      const module = await import(filePath);

      // get the class and create an instance of the class
      const moduleClass = new module.Migration();

      migrations.push({
        name: moduleClass.name || path.basename(file, path.extname(file)),
        timestamp: moduleClass.timestamp || this.extractTimestamp(file),
        up: moduleClass.up,
        down: moduleClass.down,
      });
    }

    return migrations.sort((a, b) => a.timestamp - b.timestamp);
  }

  private extractTimestamp(filename: string): number {
    const match = filename.match(/^(\d+)/);
    return match ? parseInt(match[1]?? "1 ", 10) : 0;
  }

  // Get executed migrations from database
  async getExecutedMigrations(): Promise<MigrationRecord[]> {
    const result = await this.lakesOrm.db.query(
      `SELECT * FROM ${this.tableName} ORDER BY timestamp ASC`
    );
    return result.rows;
  }

  // Calculate checksum for migration content
  private async calculateChecksum(migration: Migration): Promise<string> {
    const content = migration.up.toString() + migration.down.toString();
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  // Acquire migration lock
  private async acquireLock(): Promise<boolean> {
    const lockId = `${process.pid}-${Date.now()}`;

    const result = await this.lakesOrm.db.query(`
      UPDATE ${this.tableName}_lock
      SET locked_at = NOW(), locked_by = $1
      WHERE id = 1 AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '10 minutes')
      RETURNING *
    `, [lockId]);

    return result.rowCount > 0;
  }

  // Release migration lock
  private async releaseLock(): Promise<void> {
    await this.lakesOrm.db.query(`
      UPDATE ${this.tableName}_lock
      SET locked_at = NULL, locked_by = NULL
      WHERE id = 1
    `);
  }

  // Run pending migrations
  async up(options: { steps?: number } = {}): Promise<MigrationResult[]> {
    const client = await this.lakesOrm.db.connect();
    const results: MigrationResult[] = [];

    try {
      // Acquire lock
      const locked = await this.acquireLock();
      if (!locked) {
        throw new Error('Could not acquire migration lock. Another migration may be running.');
      }

      const migrations = await this.loadMigrations();
      const executed = await this.getExecutedMigrations();
      const executedNames = new Set(executed.map((m) => m.name));

      const pending = migrations.filter((m) => !executedNames.has(m.name));
      const toRun = options.steps ? pending.slice(0, options.steps) : pending;

      for (const migration of toRun) {
        const startTime = Date.now();

        try {
          await client.query('BEGIN');

          const ctx: MigrationContext = {
            query: (sql, params) => client.query(sql, params),
            log: (msg) => console.log(`  [${migration.name}] ${msg}`),
          };

          console.log(`Running migration: ${migration.name}`);
          await migration.up(ctx);

          // Record migration
          const checksum = await this.calculateChecksum(migration);
          await client.query(
            `INSERT INTO ${this.tableName} (name, timestamp, checksum) VALUES ($1, $2, $3)`,
            [migration.name, migration.timestamp, checksum]
          );

          await client.query('COMMIT');

          results.push({
            name: migration.name,
            status: 'success',
            duration: Date.now() - startTime,
          });

          console.log(`Completed: ${migration.name} (${Date.now() - startTime}ms)`);
        } catch (error) {
          // ROLLBACK  if failed
          await client.query('ROLLBACK');

          results.push({
            name: migration.name,
            status: 'failed',
            duration: Date.now() - startTime,
            error: (error as Error).message,
          });

          console.error(`Failed: ${migration.name}`, error);
          throw error; // Stop on first failure
        }
      }

      return results;
    } finally {
      await this.releaseLock();
      client.release();
    }
  }

  // Rollback migrations
  async down(options: { steps?: number } = {}): Promise<MigrationResult[]> {
    const client = await this.lakesOrm.db.connect();
    const results: MigrationResult[] = [];

    try {
      const locked = await this.acquireLock();
      if (!locked) {
        throw new Error('Could not acquire migration lock.');
      }

      const migrations = await this.loadMigrations();
      const executed = await this.getExecutedMigrations();

      // Get migrations to rollback (most recent first)
      const toRollback = executed
        .slice()
        .reverse()
        .slice(0, options.steps || 1);

      for (const record of toRollback) {
        const migration = migrations.find((m) => m.name === record.name);

        if (!migration) {
          console.warn(`Migration file not found for: ${record.name}`);
          continue;
        }

        const startTime = Date.now();

        try {
          await client.query('BEGIN');

          const ctx: MigrationContext = {
            query: (sql, params) => client.query(sql, params),
            log: (msg) => console.log(`  [${migration.name}] ${msg}`),
          };

          console.log();

          console.log(`Rolling back: ${migration.name}`);
          await migration.down(ctx);

          // Remove migration record
          await client.query(
            `DELETE FROM ${this.tableName} WHERE name = $1`,
            [migration.name]
          );

          await client.query('COMMIT');

          results.push({
            name: migration.name,
            status: 'success',
            duration: Date.now() - startTime,
          });

          console.log(`Rolled back: ${migration.name} (${Date.now() - startTime}ms)`);
        } catch (error) {
          await client.query('ROLLBACK');

          results.push({
            name: migration.name,
            status: 'failed',
            duration: Date.now() - startTime,
            error: (error as Error).message,
          });

          throw error;
        }
      }

      return results;
    } finally {
      await this.releaseLock();
      client.release();
    }
  }

  // Get migration status
  async status(): Promise<{ pending: string[]; executed: string[] }> {
    const migrations = await this.loadMigrations();
    const executed = await this.getExecutedMigrations();
    const executedNames = new Set(executed.map((m) => m.name));

    return {
      pending: migrations.filter((m) => !executedNames.has(m.name)).map((m) => m.name),
      executed: executed.map((m) => m.name),
    };
  }

  // Close database connection
  async close(): Promise<void> {
    await this.lakesOrm.db.end();
  }
}