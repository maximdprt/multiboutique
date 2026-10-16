// Types de scripts/migrations.mjs (utilisé par les tests en TypeScript).
export type Migration = { version: string; file: string };
export declare const MIGRATIONS_DIR: string;
export declare function listMigrations(dir?: string): Migration[];
export declare function pendingMigrations(all: Migration[], applied: string[]): Migration[];
