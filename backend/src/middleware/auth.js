import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret_change_me";

export function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "12h" });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export { JWT_SECRET };
