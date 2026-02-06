import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HUNTS_DIR = path.join(__dirname, "hunts");

export interface Hunt {
  id: string;
  filename: string;
  content: string;
}

/**
 * Extract hunt ID from markdown content
 * Looks for "**Hunt ID:** <id>" pattern
 */
function extractHuntId(content: string): string {
  const match = content.match(/\*\*Hunt ID:\*\*\s*([^\s\n]+)/);
  return match ? match[1] : "UNKNOWN";
}

/**
 * Load all hunt markdown files
 */
export async function loadHunts(): Promise<Hunt[]> {
  const files = await fs.readdir(HUNTS_DIR);
  const mdFiles = files.filter((f) => f.endsWith(".md"));

  const hunts = await Promise.all(
    mdFiles.map(async (file) => {
      const content = await fs.readFile(path.join(HUNTS_DIR, file), "utf-8");
      const id = extractHuntId(content);

      return {
        id,
        filename: file,
        content
      };
    })
  );

  return hunts;
}

/**
 * Load a single hunt by ID
 */
export async function loadHunt(huntId: string): Promise<Hunt | null> {
  const hunts = await loadHunts();
  return hunts.find((h) => h.id === huntId) || null;
}

/**
 * Get hunt summary (for listing)
 */
export function getHuntSummary(hunt: Hunt): {
  id: string;
  title: string;
  goal: string;
} {
  const lines = hunt.content.split("\n");
  const titleLine = lines.find((l) => l.startsWith("# Hunt:"));
  const goalLine = lines.find((l) => l.startsWith("**Goal:**"));

  return {
    id: hunt.id,
    title: titleLine ? titleLine.replace("# Hunt:", "").trim() : "Unknown",
    goal: goalLine ? goalLine.replace("**Goal:**", "").trim() : "Unknown"
  };
}
