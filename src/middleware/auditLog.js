const AuditLog = require("../models/AuditLog");
const logger = require("../utils/logger");

const auditLog = (action, resource) => async (req, res, next) => {
  const start = Date.now();
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    const duration = Date.now() - start;
    // Log async without blocking response
    setImmediate(async () => {
      try {
        await AuditLog.create({
          user: req.user?._id,
          action,
          resource,
          resourceId: req.params?.id,
          details: {
            body: req.method !== "GET" ? req.body : undefined,
            query: req.query,
            params: req.params,
          },
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get("User-Agent"),
          method: req.method,
          endpoint: req.originalUrl,
          statusCode: res.statusCode,
          duration,
          isSuccess: res.statusCode < 400,
        });
      } catch (err) {
        logger.error("AuditLog error:", err.message);
      }
    });
    return originalJson(body);
  };

  next();
};

module.exports = { auditLog };
