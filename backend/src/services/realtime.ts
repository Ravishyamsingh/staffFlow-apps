import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { config } from "../config.js";
import { deleteItem, scanItems } from "../lib/db.js";
import { keys } from "../lib/keys.js";
import type { RequestRecord } from "../types.js";

type Connection = { PK: string; SK: string; entityType: string; principalId?: string; groups?: string | string[] };

export async function broadcastRequestEvent(type: string, request: RequestRecord) {
  if (!config.websocketEndpoint) return;
  try {
    const connections = await scanItems<Connection>({
      TableName: config.connectionsTableName,
      FilterExpression: "entityType = :type",
      ExpressionAttributeValues: { ":type": "WS_CONNECTION" },
    });
    if (!connections.length) return;
    const client = new ApiGatewayManagementApiClient({ endpoint: config.websocketEndpoint, region: config.region });
    const payload = Buffer.from(JSON.stringify({ type, request, sentAt: new Date().toISOString() }));
    await Promise.all(connections.filter((connection) => isAllowedRecipient(connection, request)).map(async (connection) => {
      const connectionId = connection.PK.startsWith("CONNECTION#") ? connection.PK.slice("CONNECTION#".length) : "";
      if (!connectionId) return;
      try {
        await client.send(new PostToConnectionCommand({ ConnectionId: connectionId, Data: payload }));
      } catch (error) {
        const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (statusCode === 410) await deleteItem(keys.connection(connectionId), config.connectionsTableName);
        else console.warn("Unable to publish WebSocket event", error);
      }
    }));
  } catch (error) {
    console.warn("WebSocket broadcast skipped", error);
  }
}

function isAllowedRecipient(connection: Connection, request: RequestRecord) {
  if (connection.principalId === request.ownerId) return true;
  if (connection.groups) {
    const groups = Array.isArray(connection.groups) ? connection.groups : connection.groups.split(/[ ,]+/);
    if (groups.includes("admin") || groups.includes("operation")) return true;
  }
  return false;
}
