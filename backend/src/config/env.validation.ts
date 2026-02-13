type NodeEnv = 'development' | 'test' | 'production';

const allowedNodeEnvs: ReadonlySet<NodeEnv> = new Set([
  'development',
  'test',
  'production',
]);

interface EnvironmentConfig {
  [key: string]: unknown;
}

export interface EnvironmentVariables extends EnvironmentConfig {
  NODE_ENV: NodeEnv;
  PORT: string;
  DB_HOST: string;
  DB_PORT: string;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_SYNCHRONIZE: 'true' | 'false';
  DB_SSL: 'true' | 'false';
  JWT_SECRET?: string;
  JWT_EXPIRES_IN: string;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
  ADMIN_NAME: string;
  ADMIN_ROLE: string;
}

function readString(
  config: EnvironmentConfig,
  key: string,
  fallback?: string,
): string {
  const value = config[key];
  if (value === undefined || value === null || String(value).trim() === '') {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`${key} must be defined.`);
  }

  return String(value).trim();
}

function readOptionalString(
  config: EnvironmentConfig,
  key: string,
): string | undefined {
  const value = config[key];
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized === '' ? undefined : normalized;
}

function normalizeBoolean(value: string, key: string): 'true' | 'false' {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === 'false') {
    return normalized;
  }

  throw new Error(`${key} must be either "true" or "false".`);
}

function normalizePort(value: string, key: string): string {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`${key} must be a valid TCP port (1-65535).`);
  }

  return String(parsed);
}

export function validateEnv(config: EnvironmentConfig): EnvironmentVariables {
  const nodeEnvRaw = readString(config, 'NODE_ENV', 'development').toLowerCase();
  if (!allowedNodeEnvs.has(nodeEnvRaw as NodeEnv)) {
    throw new Error('NODE_ENV must be one of: development, test, production.');
  }
  const nodeEnv = nodeEnvRaw as NodeEnv;

  const port = normalizePort(readString(config, 'PORT', '3000'), 'PORT');
  const dbHost = readString(config, 'DB_HOST', 'localhost');
  const dbPort = normalizePort(readString(config, 'DB_PORT', '5432'), 'DB_PORT');
  const dbUsername = readString(config, 'DB_USERNAME', 'postgres');
  const dbPassword = readString(config, 'DB_PASSWORD', 'postgres');
  const dbName = readString(config, 'DB_NAME', 'inventory_pos');
  const dbSynchronize = normalizeBoolean(
    readString(config, 'DB_SYNCHRONIZE', 'false'),
    'DB_SYNCHRONIZE',
  );
  const dbSsl = normalizeBoolean(readString(config, 'DB_SSL', 'false'), 'DB_SSL');
  const jwtSecret = readOptionalString(config, 'JWT_SECRET');
  const jwtExpiresIn = readString(config, 'JWT_EXPIRES_IN', '8h');
  const adminEmail = readString(config, 'ADMIN_EMAIL', 'admin@inventory.local');
  const adminPassword = readString(config, 'ADMIN_PASSWORD', 'ChangeMe123!');
  const adminName = readString(config, 'ADMIN_NAME', 'System Admin');
  const adminRole = readString(config, 'ADMIN_ROLE', 'super_admin');

  if (nodeEnv === 'production') {
    if (!jwtSecret || jwtSecret === 'replace_with_strong_secret') {
      throw new Error('JWT_SECRET must be set to a strong value in production.');
    }

    if (dbSynchronize === 'true') {
      throw new Error('DB_SYNCHRONIZE must be false in production.');
    }

    if (adminPassword === 'ChangeMe123!') {
      throw new Error(
        'ADMIN_PASSWORD must be changed from the default in production.',
      );
    }
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    PORT: port,
    DB_HOST: dbHost,
    DB_PORT: dbPort,
    DB_USERNAME: dbUsername,
    DB_PASSWORD: dbPassword,
    DB_NAME: dbName,
    DB_SYNCHRONIZE: dbSynchronize,
    DB_SSL: dbSsl,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: jwtExpiresIn,
    ADMIN_EMAIL: adminEmail,
    ADMIN_PASSWORD: adminPassword,
    ADMIN_NAME: adminName,
    ADMIN_ROLE: adminRole,
  };
}
