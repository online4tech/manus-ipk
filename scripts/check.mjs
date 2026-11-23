import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const routes = JSON.parse(await readFile(new URL("../public/manus-routes.json", import.meta.url), "utf8"));
const required = [
  ["Arabic language and RTL direction", /<html lang="ar" dir="rtl">/],
  ["page title", /<title>Manus IPK/],
  ["features section", /id="features"/],
  ["installation section", /id="install"/],
  ["compatibility section", /id="compatibility"/],
  ["FAQ section", /id="faq"/],
  ["GitHub repository link", /https:\/\/github\.com\/online4tech\/manus-ipk/],
  ["responsive viewport", /name="viewport"/],
  ["relative stylesheet path for project Pages", /href="\.\/styles\.css"/],
  ["relative script path for project Pages", /src="\.\/script\.js"/],
];

const failures = required.filter(([, pattern]) => !pattern.test(html)).map(([name]) => name);
if (!Array.isArray(routes.routes) || routes.routes.length !== 1 || routes.routes[0]?.path !== "/") {
  failures.push("route manifest root entry");
}

if (failures.length > 0) {
  console.error(`Validation failed: ${failures.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("Landing page structure, Pages asset paths, and route manifest are valid.");
}
