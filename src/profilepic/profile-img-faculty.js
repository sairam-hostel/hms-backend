const router = require("express").Router();
const verify = require("./src/common/middleware");
const multer = require("multer");
const Faculty = require("../accounts/creation-faculty").Faculty;
const Student = require("../accounts/creation-students").Student;

const { s3Client, MINIO_BUCKET,ensureBucket } = require("../common/minio-cfg");
ensureBucket();   

const crypto = require("crypto");
const { S3RequestPresigner } = require("@aws-sdk/s3-request-presigner");
const { HttpRequest } = require("@aws-sdk/protocol-http");
const { formatUrl } = require("@aws-sdk/util-format-url");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { Sha256 } = require("@aws-sdk/hash-node");

const upload = multer({ storage: multer.memoryStorage() });

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
    path: `/${MINIO_BUCKET}/${objectKey}`
  });

  return formatUrl(await signer.presign(req, { expiresIn: 300 }));
}

    // ---------------------------
    // UPLOAD (faculty → any user)
    // ---------------------------
    router.post("/upload-photo/:auth_user_id", verify, upload.single("photo"), async (req, res) => {
    if (req.user.role !== "faculty") {
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

// ---------------------------
// VIEW ANY USER PHOTO (faculty)
// ---------------------------
router.get("/photo-url/:auth_user_id", verify, async (req, res) => {
  if (req.user.role !== "faculty") {
    return res.status(403).json({ issue: "forbidden" });
  }

  const targetId = req.params.auth_user_id;

  let record =
    await Faculty.findOne({ auth_user_id: targetId }).select("profile_image_key") ||
    await Student.findOne({ auth_user_id: targetId }).select("profile_image_key");

  if (!record?.profile_image_key) {
    return res.status(404).json({ issue: "not_found" });
  }

  res.json({
    success: true,
    url: await signedUrl(record.profile_image_key)
  });
});

module.exports = router;
