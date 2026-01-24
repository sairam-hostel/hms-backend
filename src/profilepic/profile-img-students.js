import express from "express";
import axios from "axios";
import crypto from "crypto";

import verify from "../common/middleware.js";
import { Student } from "../accounts/creation-students.js";
import { s3Client, MINIO_BUCKET } from "../common/minio-cfg.js";
import { URL } from "url";

import { S3RequestPresigner } from "@aws-sdk/s3-request-presigner";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { formatUrl } from "@aws-sdk/util-format-url";
import { Hash } from "@aws-sdk/hash-node";

const router = express.Router();


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
 

// ----------------------------------------------
// STUDENT VIEW OWN PHOTO (proxy)
// ----------------------------------------------
router.get("/view", verify, async (req, res) => {

  if (req.user.role !== "student") {
    return res.status(403).json({ issue: "forbidden" });
  }

  const stu = await Student.findOne({ auth_user_id: req.user.auth_user_id })
    .select("profile_image_key");

  if (!stu?.profile_image_key) {
    return res.status(404).json({ issue: "not_found" });
  }

  
  const url = await signedUrl(stu.profile_image_key);

  const response = await axios.get(url, { responseType: "stream" });

  res.setHeader("Content-Type", response.headers["content-type"]);
  response.data.pipe(res);
});

export default router;

