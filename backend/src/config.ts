import { z } from "zod";

const emptyAsUndefined = (value: unknown) => value === "" ? undefined : value;
const optionalString = (schema = z.string().min(1)) => z.preprocess(emptyAsUndefined, schema.optional());
const optionalUrl = z.preprocess(emptyAsUndefined, z.string().url().optional());

const EnvironmentSchema = z.object({
  AWS_REGION: z.preprocess(emptyAsUndefined, z.string().min(1).default("ap-south-1")),
  DYNAMODB_TABLE_NAME: z.preprocess(emptyAsUndefined, z.string().min(1).default("StaffFlow")),
  S3_BUCKET_NAME: optionalString(z.string().min(3)),
  COGNITO_USER_POOL_ID: optionalString(),
  COGNITO_CLIENT_ID: optionalString(),
  COGNITO_MOBILE_CLIENT_ID: optionalString(),
  COGNITO_ISSUER_URL: optionalUrl,
  GEMINI_API_KEY: optionalString(),
  GEMINI_MODEL: z.preprocess(emptyAsUndefined, z.string().min(1).default("gemini-2.0-flash")),
  CORS_ORIGINS: z.preprocess(emptyAsUndefined, z.string().default("http://localhost:3000,http://localhost:8081")),
  WEBSOCKET_API_ENDPOINT: optionalUrl,
  WS_CONNECTIONS_TABLE_NAME: z.preprocess(emptyAsUndefined, z.string().min(1).default("StaffFlow")),
});

export type BackendConfig = {
  region: string;
  tableName: string;
  bucketName?: string;
  cognitoUserPoolId?: string;
  cognitoClientId?: string;
  cognitoMobileClientId?: string;
  cognitoIssuerUrl?: string;
  geminiApiKey?: string;
  geminiModel: string;
  corsOrigins: string[];
  websocketEndpoint?: string;
  connectionsTableName: string;
};

export function getConfig(environment: NodeJS.ProcessEnv = process.env): BackendConfig {
  const parsed = EnvironmentSchema.parse(environment);
  return {
    region: parsed.AWS_REGION,
    tableName: parsed.DYNAMODB_TABLE_NAME,
    bucketName: parsed.S3_BUCKET_NAME,
    cognitoUserPoolId: parsed.COGNITO_USER_POOL_ID,
    cognitoClientId: parsed.COGNITO_CLIENT_ID,
    cognitoMobileClientId: parsed.COGNITO_MOBILE_CLIENT_ID,
    cognitoIssuerUrl: parsed.COGNITO_ISSUER_URL,
    geminiApiKey: parsed.GEMINI_API_KEY,
    geminiModel: parsed.GEMINI_MODEL,
    corsOrigins: parsed.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
    websocketEndpoint: parsed.WEBSOCKET_API_ENDPOINT,
    connectionsTableName: parsed.WS_CONNECTIONS_TABLE_NAME,
  };
}

export const config = getConfig();
