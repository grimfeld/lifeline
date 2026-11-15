export const PW_BROWSERS: string;
export function portFree(port: number, host: string, listen?: () => import("node:net").Server): Promise<boolean>;
export function free(port: number): Promise<boolean>;
export function preinstalledChromium(dir?: string, platform?: string, exists?: (p: string) => boolean, list?: (p: string) => string[]): string | undefined;
