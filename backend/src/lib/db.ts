import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { config } from "../config.js";

export const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.region }), {
  marshallOptions: { removeUndefinedValues: true },
});

export async function getItem<T>(key: Record<string, string>, tableName = config.tableName) {
  const result = await documentClient.send(new GetCommand({ TableName: tableName, Key: key, ConsistentRead: true }));
  return result.Item as T | undefined;
}

export async function putItem<T extends Record<string, unknown>>(item: T, tableName = config.tableName) {
  await documentClient.send(new PutCommand({ TableName: tableName, Item: item }));
  return item;
}

export async function deleteItem(key: Record<string, string>, tableName = config.tableName) {
  await documentClient.send(new DeleteCommand({ TableName: tableName, Key: key }));
}

export async function updateItem<T>(input: ConstructorParameters<typeof UpdateCommand>[0]) {
  const result = await documentClient.send(new UpdateCommand({ ...input, ReturnValues: "ALL_NEW" }));
  return result.Attributes as T;
}

export async function queryItems<T>(input: ConstructorParameters<typeof QueryCommand>[0]) {
  const result = await documentClient.send(new QueryCommand(input));
  return (result.Items ?? []) as T[];
}

export async function scanItems<T>(input: ConstructorParameters<typeof ScanCommand>[0]) {
  const result = await documentClient.send(new ScanCommand(input));
  return (result.Items ?? []) as T[];
}

export async function transactWrite(input: Omit<ConstructorParameters<typeof TransactWriteCommand>[0], "TransactItems"> & { TransactItems: NonNullable<ConstructorParameters<typeof TransactWriteCommand>[0]["TransactItems"]> }) {
  await documentClient.send(new TransactWriteCommand(input));
}

type BatchWriteRequest = NonNullable<ConstructorParameters<typeof BatchWriteCommand>[0]["RequestItems"]>[string][number];

export async function batchWrite(tableName: string, requests: BatchWriteRequest[]) {
  for (let offset = 0; offset < requests.length; offset += 25) {
    let pending = requests.slice(offset, offset + 25);
    let attempts = 0;
    while (pending.length > 0 && attempts < 5) {
      const result = await documentClient.send(new BatchWriteCommand({ RequestItems: { [tableName]: pending } }));
      pending = result.UnprocessedItems?.[tableName] ?? [];
      attempts += 1;
      if (pending.length > 0) await new Promise((resolve) => setTimeout(resolve, 25 * attempts));
    }
    if (pending.length > 0) throw new Error("DynamoDB batch write did not complete after retries");
  }
}
