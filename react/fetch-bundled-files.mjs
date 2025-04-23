import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Fetch and save URLs
async function fetchAndSaveFiles(urls, outputDir) {
  const imports = [];

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const url of urls) {
    try {
      const response = await fetch(url);
      const data = await response.arrayBuffer();

      // Extract the filename from the URL
      const urlObj = new URL(url);
      const filename = path.basename(urlObj.pathname);
      const filePath = path.join(outputDir, filename);

      // Write the file to disk
      fs.writeFileSync(filePath, Buffer.from(data));

      // Create import statement
      const importName = path
        .parse(filename)
        .name.replace(/[^a-zA-Z0-9_$]/g, "_");
      imports.push(`import ${importName} from './${filename}';`);
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error);
    }
  }

  return imports;
}

// Create an index file that exports the downloaded files using string concatenation
function createIndexFile(imports, outputDir, urls) {
  const filePath = path.join(outputDir, "index.js");
  let content = imports.join("\n") + "\n\n";
  content += "function getBase64Data(url) {\n";
  content += "  const urlMapping = {\n";
  imports.forEach((importString, i) => {
    const match = importString.match(/import\s+(\w+)\s+from/);
    const hash = match ? match[1] : "undefined";
    content += `    "${urls[i]}": ${hash}.split(';base64,')[1],\n`;
  });
  content += "  };\n";
  content += "  return urlMapping[url] || null;\n";
  content += "}\n";
  content += "export { getBase64Data };\n";
  fs.writeFileSync(filePath, content);
}

// Main function
async function main() {
  const reactBundledUrls = process.env.REACT_BUNDLED_URLS;
  if (!reactBundledUrls) {
    console.error("REACT_BUNDLED_URLS is not defined in the .env file");
    process.exit(1);
  }

  const urls = JSON.parse(reactBundledUrls);
  const outputDir = path.resolve("src/BUNDLED");

  const imports = await fetchAndSaveFiles(urls, outputDir);
  createIndexFile(imports, outputDir, urls);

  console.log(`Files fetched and saved in ${outputDir}`);
  console.log(`Index file created at ${path.join(outputDir, "index.js")}`);
}

main().catch(console.error);
