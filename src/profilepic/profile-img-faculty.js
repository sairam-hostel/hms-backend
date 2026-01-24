import express from "express";
import multer from "multer";
import axios from "axios";
import crypto from "crypto";

import verify from "../common/middleware.js";
import { Faculty } from "../accounts/creation-faculty.js";
import { Student } from "../accounts/creation-students.js";

import { s3Client, MINIO_BUCKET, ensureBucket } from "../common/minio-cfg.js";
import { URL } from "url";
import { S3RequestPresigner } from "@aws-sdk/s3-request-presigner";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { formatUrl } from "@aws-sdk/util-format-url";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { Hash } from "@aws-sdk/hash-node";

import { ROLE_GROUPS } from "../common/roles.js";

const router = express.Router();

ensureBucket();

const upload = multer({ storage: multer.memoryStorage() });


async function signedUrl(objectKey) {
  const endpoint = new URL(process.env.MINIO_ENDPOINT);

  const signer = new S3RequestPresigner({
    ...s3Client.config,
    sha256: Hash.bind(null, "sha256"),
  });

  const req = new HttpRequest({
    protocol: endpoint.protocol,     // http:
    hostname: endpoint.hostname,      // 20.6.95.37
    port: Number(endpoint.port),      // 9000 ✅
    method: "GET",
    path: `/${MINIO_BUCKET}/${objectKey}`,
  });

  return formatUrl(await signer.presign(req, { expiresIn: 300 }));
}
 
    // ---------------------------
    // UPLOAD (faculty → any user)
    // ---------------------------
    router.post("/upload-photo/:auth_user_id", verify, upload.single("photo"), async (req, res) => {
    if (!ROLE_GROUPS.FACULTY.includes(req.user.role)) {
      return res.status(403).json({ issue: "forbidden" });
    }

    if (!req.file) {
        return res.status(400).json({ issue: "missing_file" });
    }

    const targetId = req.params.auth_user_id;
    const objectKey = `${targetId}.jpg`;

    try {
        await s3Client.send(new PutObjectCommand({
        Bucket: MINIO_BUCKET,
        Key: objectKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype
        }));

        await Faculty.updateOne({ auth_user_id: targetId }, { profile_image_key: objectKey });
        await Student.updateOne({ auth_user_id: targetId }, { profile_image_key: objectKey });

        res.json({ success: true, object_key: objectKey });

    } catch (err) {
        console.error(err);
        res.status(500).json({ issue: "server_error" });
    }
    });

// ----------------------------------------------
// PROXY IMAGE VIEW (faculty → any user)
// ----------------------------------------------
router.get("/view/:auth_user_id", verify, async (req, res) => {

  if (!ROLE_GROUPS.FACULTY.includes(req.user.role)) {
    return res.status(403).json({ issue: "forbidden" });
  }
  const targetId = req.params.auth_user_id;

  let record =
    await Faculty.findOne({ auth_user_id: targetId }).select("profile_image_key") ||
    await Student.findOne({ auth_user_id: targetId }).select("profile_image_key");

  if (!record?.profile_image_key) {
    return res.status(404).json({ issue: "not_found" });
  }

  // Generate signed MinIO URL
  const url = await signedUrl(record.profile_image_key);

  // Stream the file
  const response = await axios.get(url, { responseType: "stream" });

  res.setHeader("Content-Type", response.headers["content-type"]);
  response.data.pipe(res);   // DIRECT STREAM
});

export default router;
