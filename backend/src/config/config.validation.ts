import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),

  DB_HOST: Joi.string().hostname().required(),
  DB_PORT: Joi.number().integer().min(1).max(65535).default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_SYNCHRONIZE: Joi.boolean().truthy('true').falsy('false').default(false),
  DB_SSL: Joi.boolean().truthy('true').falsy('false').default(false),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('8h'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  CORS_ORIGINS: Joi.string().required(),
  RATE_LIMIT_TTL_SECONDS: Joi.number().integer().min(1).default(60),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().integer().min(1).default(120),
  DASHBOARD_CACHE_TTL_SECONDS: Joi.number().integer().min(1).default(30),

  ADMIN_EMAIL: Joi.string().email().required(),
  ADMIN_PASSWORD: Joi.string().min(8).required(),
  ADMIN_NAME: Joi.string().min(1).required(),
  ADMIN_ROLE: Joi.string().min(1).default('super_admin'),

  FILE_SIGNING_SECRET: Joi.string().min(16).required(),

  MAIL_TRANSPORT: Joi.string().valid('spool', 'smtp').default('spool'),
  EMAIL_FROM: Joi.string().email().required(),
  SMTP_HOST: Joi.when('MAIL_TRANSPORT', {
    is: 'smtp',
    then: Joi.string().hostname().required(),
    otherwise: Joi.string().allow('', null).optional(),
  }),
  SMTP_PORT: Joi.when('MAIL_TRANSPORT', {
    is: 'smtp',
    then: Joi.number().integer().min(1).max(65535).required(),
    otherwise: Joi.number().integer().min(1).max(65535).optional(),
  }),
  SMTP_USER: Joi.when('MAIL_TRANSPORT', {
    is: 'smtp',
    then: Joi.string().required(),
    otherwise: Joi.string().allow('', null).optional(),
  }),
  SMTP_PASSWORD: Joi.when('MAIL_TRANSPORT', {
    is: 'smtp',
    then: Joi.string().required(),
    otherwise: Joi.string().allow('', null).optional(),
  }),
}).options({
  abortEarly: false,
  allowUnknown: true,
});
