const router = require("express").Router();
const verify = require("./src/common/middleware");

const Student = require("../accounts/creation-students");

const { s3Client, MINIO_BUCKET } = require("../common/minio-cfg");

const crypto = require("crypto");
const { S3RequestPresigner } = require("@aws-sdk/s3-request-presigner");
const { HttpRequest } = require("@aws-sdk/protocol-http");
const { formatUrl } = require("@aws-sdk/util-format-url");
const { Sha256 } = require("@aws-sdk/hash-node");

async function signedUrl(objectKey) {
  const signer = new S3RequestPresigner({
    ...s3Client.config,
    sha256: (0, require("@aws-sdk/hash-node").Sha256),
  });

  const req = new HttpRequest({
    ...s3Client.config,
    protocol: "http:",
    hostname: process.env.MINIO_HOST,
    method: "GET",
    path: `/${MINIO_BUCKET}/${objectKey}`,
  });

  return formatUrl(await signer.presign(req, { expiresIn: 300 }));
}

// ---------------------------
// STUDENT VIEW OWN PHOTO
// ---------------------------
router.get("/photo-url", verify, async (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({ issue: "forbidden" });
  }

  const stu = await Student.findOne({ auth_user_id: req.user.auth_user_id })
    .select("profile_image_key");

  if (!stu?.profile_image_key) {
    return res.status(404).json({ issue: "not_found" });
  }

  res.json({
    success: true,
    url: await signedUrl(stu.profile_image_key)
  });
});

module.exports = router;
