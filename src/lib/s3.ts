import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.AWS_DEFAULT_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_BUCKET!;

export async function uploadToS3(
  buffer: Buffer | ArrayBuffer,
  key: string,
  contentType: string
): Promise<string> {
  console.log("DEBUG: inside uploadToS3");
  console.log("DEBUG: BUCKET_NAME is:", BUCKET_NAME);
  console.log("DEBUG: process.env.AWS_BUCKET is:", process.env.AWS_BUCKET);
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer instanceof ArrayBuffer ? Buffer.from(buffer) : buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);

  // Use the provided AWS_URL for cleaner link generation
  const baseUrl = process.env.AWS_URL?.replace(/\/$/, "");
  return `${baseUrl}/${key}`;
}

export async function deleteFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

export function getS3KeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    let key = decodeURIComponent(urlObj.pathname.substring(1));
    
    // Handle format: https://s3.region.amazonaws.com/bucket-name/key
    const bucketName = (process.env.AWS_BUCKET || "").replace(/"/g, "");
    if (bucketName && key.startsWith(`${bucketName}/`)) {
      key = key.substring(bucketName.length + 1);
    }
    
    return key;
  } catch {
    return null;
  }
}

export async function getPresignedUrl(url: string, expiresIn: number = 3600): Promise<string> {
  const key = getS3KeyFromUrl(url);
  if (!key) return url;

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return url;
  }
}
