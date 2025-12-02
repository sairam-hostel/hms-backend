require("dotenv").config();

const { S3Client, CreateBucketCommand, HeadBucketCommand } = require("@aws-sdk/client-s3");

const MINIO_BUCKET = process.env.MINIO_BUCKET || "profileimgs";

// Read full endpoint URL from .env
const minioEndpoint = process.env.MINIO_ENDPOINT;
if (!minioEndpoint) {
  throw new Error("MINIO_ENDPOINT not defined in .env");
}

const s3Client = new S3Client({
  region: process.env.MINIO_REGION || "us-east-1",  // dummy / placeholder region
  forcePathStyle: true,                             // needed for MinIO / S3-compatible
  endpoint: minioEndpoint,
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER,
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD
  }
});

async function ensureBucket() {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET }));
    console.log("✔ Bucket exists:", MINIO_BUCKET);
  } catch (err) {
    console.log("Bucket missing → creating:", MINIO_BUCKET);
    await s3Client.send(new CreateBucketCommand({ Bucket: MINIO_BUCKET }));
    console.log("✔ Bucket created:", MINIO_BUCKET);
  }
}

module.exports = { s3Client, MINIO_BUCKET, ensureBucket };
