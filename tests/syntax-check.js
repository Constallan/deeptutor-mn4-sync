#!/usr/bin/env node
// 语法检查：读取 main.js，用 new Function 仅解析（不执行）。
// 退出码：0 = PASS，1 = FAIL。
"use strict";
const fs = require("fs");
const path = require("path");

const mainPath = path.join(__dirname, "..", "main.js");
const code = fs.readFileSync(mainPath, "utf8");

try {
  // eslint-disable-next-line no-new-func
  new Function(code);
  console.log("PASS: main.js syntax OK (" + mainPath + ")");
} catch (err) {
  console.error("FAIL: " + err.message);
  process.exit(1);
}
