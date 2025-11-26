import { parse as parseYaml } from "yaml";
import { join, dirname, resolve } from "path";
import { ConfigSchema, type ServiceConfig, type HealthcheckConfig } from "./schema";
import {
  type NormalizedConfig,
  type NormalizedService,
  type NormalizedHealthcheck,
  parseDuration,
} from "./types";

const CONFIG_FILENAMES = ["devproc.yaml", "devproc.yml"];

/**
 * Find the devproc config file in the given directory or its parents
 */
export async function findConfigFile(startDir: string = process.cwd()): Promise<string | null> {
  let currentDir = resolve(startDir);

  while (currentDir !== dirname(currentDir)) {
    for (const filename of CONFIG_FILENAMES) {
      const configPath = join(currentDir, filename);
      const file = Bun.file(configPath);
      if (await file.exists()) {
        return configPath;
      }
    }
    currentDir = dirname(currentDir);
  }

  return null;
}

/**
 * Load and parse the devproc config file
 */
export async function loadConfig(configPath?: string): Promise<NormalizedConfig> {
  const resolvedPath = configPath ?? (await findConfigFile());

  if (!resolvedPath) {
    throw new Error(`Could not find devproc.yaml in current directory or any parent directory`);
  }

  const file = Bun.file(resolvedPath);
  if (!(await file.exists())) {
    throw new Error(`Config file not found: ${resolvedPath}`);
  }

  const content = await file.text();
  const parsed = parseYaml(content);

  // Validate with Zod
  const result = ConfigSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${String(e.path.join("."))}: ${e.message}`)
      .join("\n");
    throw new Error(`Invalid config file:\n${errors}`);
  }

  const config = result.data;
  const configDir = dirname(resolvedPath);

  // Load dotenv file if specified
  let dotenvVars: Record<string, string> = {};
  if (config.dotenv) {
    const dotenvPath = resolve(configDir, config.dotenv);
    dotenvVars = await loadDotenv(dotenvPath);
  }

  // Merge global environment variables
  const globalEnv = {
    ...dotenvVars,
    ...config.env,
  };

  // Normalize all services
  const services = new Map<string, NormalizedService>();
  for (const [name, serviceConfig] of Object.entries(config.services)) {
    services.set(name, normalizeService(name, serviceConfig, configDir, globalEnv));
  }

  // Validate dependencies exist
  for (const [name, service] of services) {
    for (const dep of service.dependsOn.keys()) {
      if (!services.has(dep)) {
        throw new Error(`Service "${name}" depends on unknown service "${dep}"`);
      }
    }
  }

  // Check for circular dependencies
  validateNoCycles(services);

  return {
    name: config.name,
    env: globalEnv,
    services,
  };
}

/**
 * Load environment variables from a .env file
 */
async function loadDotenv(path: string): Promise<Record<string, string>> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    console.warn(`Warning: dotenv file not found: ${path}`);
    return {};
  }

  const content = await file.text();
  const vars: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Remove surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    vars[key] = value;
  }

  return vars;
}

/**
 * Normalize a service configuration
 */
function normalizeService(
  name: string,
  config: ServiceConfig,
  configDir: string,
  globalEnv: Record<string, string>,
): NormalizedService {
  // Parse depends_on into a Map
  const dependsOn = new Map<string, "started" | "healthy">();
  if (config.depends_on) {
    if (Array.isArray(config.depends_on)) {
      // Simple array form: just wait for service to start
      for (const dep of config.depends_on) {
        dependsOn.set(dep, "started");
      }
    } else {
      // Object form with conditions
      for (const [dep, condition] of Object.entries(config.depends_on)) {
        dependsOn.set(dep, condition);
      }
    }
  }

  // Parse healthcheck
  let healthcheck: NormalizedHealthcheck | undefined;
  if (config.healthcheck) {
    if (typeof config.healthcheck === "string") {
      // Shorthand: just a command
      healthcheck = {
        cmd: config.healthcheck,
        intervalMs: 2000,
        timeoutMs: 5000,
        retries: 10,
      };
    } else {
      healthcheck = {
        cmd: config.healthcheck.cmd,
        intervalMs: parseDuration(config.healthcheck.interval),
        timeoutMs: parseDuration(config.healthcheck.timeout),
        retries: config.healthcheck.retries,
      };
    }
  }

  // Parse stop signal
  const stopSignal = (config.stop_signal.toUpperCase() as NodeJS.Signals) || "SIGTERM";

  return {
    name,
    cmd: config.cmd,
    cwd: config.cwd ? resolve(configDir, config.cwd) : configDir,
    env: {
      ...globalEnv,
      ...config.env,
    },
    dependsOn,
    healthcheck,
    restart: config.restart,
    color: config.color,
    stopSignal,
  };
}

/**
 * Validate that there are no circular dependencies
 */
function validateNoCycles(services: Map<string, NormalizedService>): void {
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function visit(name: string, path: string[] = []): void {
    if (inStack.has(name)) {
      const cycle = [...path, name].join(" -> ");
      throw new Error(`Circular dependency detected: ${cycle}`);
    }

    if (visited.has(name)) return;

    inStack.add(name);
    const service = services.get(name);
    if (service) {
      for (const dep of service.dependsOn.keys()) {
        visit(dep, [...path, name]);
      }
    }
    inStack.delete(name);
    visited.add(name);
  }

  for (const name of services.keys()) {
    visit(name);
  }
}

/**
 * Get services in dependency order (topological sort)
 */
export function getDependencyOrder(services: Map<string, NormalizedService>): string[] {
  const order: string[] = [];
  const visited = new Set<string>();

  function visit(name: string): void {
    if (visited.has(name)) return;
    visited.add(name);

    const service = services.get(name);
    if (service) {
      for (const dep of service.dependsOn.keys()) {
        visit(dep);
      }
    }
    order.push(name);
  }

  for (const name of services.keys()) {
    visit(name);
  }

  return order;
}
