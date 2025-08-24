const sanitize = require("mongo-sanitize");
const sanitizeHtml = require("sanitize-html");

function deepSanitize(obj) {
  if (typeof obj === "object" && obj !== null) {
    // eslint-disable-next-line no-restricted-syntax, guard-for-in
    for (const key in obj) {
      obj[key] = deepSanitize(obj[key]);
    }
    return obj;
  }
  if (typeof obj === "string") {
    return sanitizeHtml(sanitize(obj));
  }
  return obj;
}

module.exports = deepSanitize;
