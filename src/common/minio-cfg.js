require("dotenv").config();

const { 
  S3Client, 
  CreateBucketCommand, 
  HeadBucketCommand 
} = require("@aws-sdk/client-s3");

const MINIO_BUCKET = "profileimgs";

const s3Client = new S3Client({
  region: "us-east-1",
  forcePathStyle: true, 
  endpoint: {
    protocol: "http:",
    hostname: "localhost",
    port: 9000,
    path: "/"
  },
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER,
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD
  }
});

// ---------------------------------
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
// ---------------------------------



module.exports = { s3Client, MINIO_BUCKET, ensureBucket };
