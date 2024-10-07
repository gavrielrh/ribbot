import { writeAll } from "jsr:@std/io/write-all";
import { getTeasFromKv } from "./store.ts";

// Function to write objects to a JSONL file
async function writeJsonlFile(filename: string, data: Array<object>) {
  // Open the file in write mode
  const file = await Deno.open(filename, {
    write: true,
    create: true,
    truncate: true,
  });

  try {
    for (const obj of data) {
      // Convert each object to a JSON string and add a newline character
      const jsonString = JSON.stringify(obj) + "\n";
      // Encode the JSON string to bytes
      const contentBytes = new TextEncoder().encode(jsonString);
      // Write the bytes to the file
      await writeAll(file, contentBytes);
    }
  } finally {
    // Close the file
    file.close();
  }
}

const objects = await getTeasFromKv();

// Call the function to write the objects to a JSONL file
writeJsonlFile("output.jsonl", objects)
  .then(() => console.log("Objects have been written to output.jsonl"))
  .catch((error) => console.error("An error occurred:", error));
