
export interface MigrationContext {
  query: (sql: string, params?: any[]) => Promise<any>;
  log: (message: string) => void;
}

export interface Migration {
  name: string;
  timestamp: number;
  up: (ctx: MigrationContext) => Promise<void>;
  down: (ctx: MigrationContext) => Promise<void>;
}

export interface MigrationRecord {
  id: number;
  name: string;
  timestamp: number;
  executed_at: Date;
  checksum: string;
}

export interface MigrationResult {
  name: string;
  status: 'success' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}