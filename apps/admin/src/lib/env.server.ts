import "server-only";

const optional = (key: string) => process.env[key];

export function getServerEnv() {
  return {
    region: optional("AWS_REGION") ?? "ap-south-1",
    apiGatewayUrl: optional("API_GATEWAY_URL"),
    websocketUrl: optional("API_GATEWAY_WS_URL"),
    cognitoUserPoolId: optional("COGNITO_USER_POOL_ID"),
    cognitoClientId: optional("COGNITO_CLIENT_ID"),
    dynamoTableName: optional("DYNAMODB_TABLE_NAME") ?? "StaffFlow",
    geminiApiKey: optional("GEMINI_API_KEY"),
  };
}

export function assertServerSecret(key: "AUTH_SECRET" | "GEMINI_API_KEY") {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured. Copy .env.example to .env.local and add it server-side.`);
  return value;
}
