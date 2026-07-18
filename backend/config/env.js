const { z } = require("zod");

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRE: z.string().default("7d"),
  CLIENT_URL: z
    .string()
    .url("CLIENT_URL must be a valid URL")
    .default("http://localhost:5500"),
  GEOCODE_DEFAULT_COUNTRY: z.string().default("India"),
  GEOCODE_USER_AGENT: z.string().default("FoodBridge/1.0"),
  GEOCODE_LOOKUP_MODE: z
    .enum(["remote", "fallback", "hybrid"])
    .default("fallback"),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.coerce.number().optional(),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  FACEBOOK_CLIENT_ID: z.string().optional(),
  FACEBOOK_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_REDIRECT_URI: z.string().url().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_SECRET: z.string().optional(),
  APPLE_REDIRECT_URI: z.string().url().optional(),
  HUGGINGFACE_API_KEY: z.string().optional(),
});

const validateEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Environment validation failed:");
    result.error.issues.forEach((issue) => {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    });
    process.exit(1);
  }

  return result.data;
};

const env = validateEnv();

module.exports = {
  env,
  validateEnv,
};
