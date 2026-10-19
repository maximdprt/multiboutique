// Types de scripts/setup-lib.mjs (utilisé par les tests en TypeScript).
type Values = Record<string, string | undefined>;
type Project = { name?: string; link?: { type?: string; org?: string; repo?: string }; alias?: { domain: string; target?: string; environment?: string }[]; targets?: { production?: { alias?: string[] } } };
export declare function parseEnv(text: string): Record<string, string>;
export declare function setEnvValue(text: string, key: string, value: string): string;
export declare const GENERATED: Record<"ADMIN_SECRET" | "CRON_SECRET" | "ANALYTICS_SALT" | "INDEXNOW_KEY", () => string>;
export declare function generatePassword(): string;
export declare const LOCAL_ONLY: Set<string>;
export declare function varsForVercel(values: Values): { key: string; value: string; type: "encrypted"; target: string[] }[];
export declare const GITHUB_SECRETS: string[];
export declare function secretsForGithub(values: Values): { name: string; value: string }[];
export declare function repoFromRemote(remote: string): string | null;
export declare function linkedTo(project: Project, repo: string): boolean;
export declare function productionUrl(project: Project): string | null;
export declare function nodeOk(version: string, min?: string): boolean;
