import jwt from "jsonwebtoken";

export default function verify(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      issue: "missing_token",
      message: "Authorization token missing"
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // contains auth_user_id, role
    next();
  } catch (err) {
    return res.status(401).json({
      issue: "invalid_token",
      message: "Token invalid or expired"
    });
  }
}
