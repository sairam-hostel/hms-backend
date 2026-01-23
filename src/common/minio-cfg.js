import dotenv from "dotenv";
dotenv.config();

import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand
} from "@aws-sdk/client-s3";

export const MINIO_BUCKET =
  process.env.MINIO_BUCKET || "profileimgs";

// Read full endpoint URL from .env
const minioEndpoint = process.env.MINIO_ENDPOINT;
if (!minioEndpoint) {
  throw new Error("MINIO_ENDPOINT not defined in .env");
}

export const s3Client = new S3Client({
  region: process.env.MINIO_REGION || "us-east-1", // dummy region
  forcePathStyle: true,                            // needed for MinIO
  endpoint: minioEndpoint,
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER,
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD
  }
});

export async function ensureBucket() {
  try {
    await s3Client.send(
      new HeadBucketCommand({ Bucket: MINIO_BUCKET })
    );
    console.log("✔ Bucket exists:", MINIO_BUCKET);
  } catch {
    console.log("Bucket missing → creating:", MINIO_BUCKET);
    await s3Client.send(
      new CreateBucketCommand({ Bucket: MINIO_BUCKET })
    );
    console.log("✔ Bucket created:", MINIO_BUCKET);
  }
}
