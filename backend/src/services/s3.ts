import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config.js";
import { badRequest } from "../lib/errors.js";

const s3 = new S3Client({ region: config.region });

export async function createUploadUrl(input: { key: string; contentType: string; ownerId: string }) {
  if (!config.bucketName) throw badRequest("S3_BUCKET_NAME is not configured");
  const key = `owners/${input.ownerId}/${sanitizeKey(input.key)}`;
  const command = new PutObjectCommand({ Bucket: config.bucketName, Key: key, ContentType: input.contentType, ServerSideEncryption: "AES256" });
  return { key, url: await getSignedUrl(s3, command, { expiresIn: 900 }) };
}

export async function createDownloadUrl(key: string) {
  if (!config.bucketName) throw badRequest("S3_BUCKET_NAME is not configured");
  const command = new GetObjectCommand({ Bucket: config.bucketName, Key: key });
  return { key, url: await getSignedUrl(s3, command, { expiresIn: 900 }) };
}

function sanitizeKey(value: string) {
  const clean = value.replace(/[^a-zA-Z0-9._/-]/g, "-").replace(/^\/+/, "");
  if (!clean || clean.includes("..")) throw badRequest("Invalid S3 object key");
  return clean;
}
