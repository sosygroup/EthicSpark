"use strict";
function safeExternalUrl(value) {
  if (
    typeof value !== "string" ||
    value.length > 8192 ||
    /[\s\u0000-\u001f\u007f]/.test(value)
  )
    throw Error("Invalid source URL.");
  const url = new URL(value);
  if (
    !/^https?:\/\//i.test(value) ||
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw Error("Only HTTP or HTTPS source links are supported.");
  return url.href;
}
module.exports = { safeExternalUrl };
