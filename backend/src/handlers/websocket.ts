import { DeleteCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { APIGatewayAuthorizerResult, APIGatewayProxyWebsocketHandlerV2, APIGatewayRequestAuthorizerEvent } from "aws-lambda";
import { config } from "../config.js";
import { documentClient } from "../lib/db.js";
import { keys } from "../lib/keys.js";

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | undefined;

export const connect: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  if (connectionId) {
    await documentClient.send(new PutCommand({
      TableName: config.connectionsTableName,
      Item: { ...keys.connection(connectionId), entityType: "WS_CONNECTION", connectedAt: new Date().toISOString(), principalId: authorizerValue(event, "sub"), groups: authorizerValue(event, "groups") },
    }));
  }
  return { statusCode: 200, body: "Connected" };
};

export const disconnect: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  if (connectionId) await documentClient.send(new DeleteCommand({ TableName: config.connectionsTableName, Key: keys.connection(connectionId) }));
  return { statusCode: 200, body: "Disconnected" };
};

export const defaultHandler: APIGatewayProxyWebsocketHandlerV2 = async () => ({ statusCode: 200, body: "Acknowledged" });

export async function websocketAuthorizer(event: APIGatewayRequestAuthorizerEvent): Promise<APIGatewayAuthorizerResult> {
  const token = event.headers?.Authorization ?? event.headers?.authorization ?? event.queryStringParameters?.Authorization ?? event.queryStringParameters?.authorization;
  if (!token) throw new Error("Authorization token is required");
  const accessToken = token.replace(/^Bearer\s+/i, "");
  const payload = await getVerifier().verify(accessToken);
  return {
    principalId: String(payload.sub),
    policyDocument: {
      Version: "2012-10-17",
      Statement: [{ Action: "execute-api:Invoke", Effect: "Allow", Resource: event.methodArn }],
    },
    context: { sub: String(payload.sub), groups: String(payload["cognito:groups"] ?? "") },
  };
}

function getVerifier() {
  if (verifier) return verifier;
  if (!config.cognitoUserPoolId) throw new Error("COGNITO_USER_POOL_ID is not configured");
  const clientIds = [config.cognitoClientId, config.cognitoMobileClientId].filter((value): value is string => Boolean(value));
  if (!clientIds.length) throw new Error("No Cognito app client is configured");
  verifier = CognitoJwtVerifier.create({ userPoolId: config.cognitoUserPoolId, tokenUse: "access", clientId: clientIds });
  return verifier;
}

function authorizerValue(event: Parameters<APIGatewayProxyWebsocketHandlerV2>[0], key: string) {
  const requestContext = event.requestContext as unknown as { authorizer?: Record<string, unknown> };
  const authorizer = requestContext.authorizer;
  return authorizer?.[key];
}
