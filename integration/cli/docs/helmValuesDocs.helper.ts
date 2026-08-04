import fs from "node:fs";

const customizationDocsPath = "./docs/user-guide/customization.md";
const tableHeading = "### Helm Values Reference";

export type HelmValueDoc = {
  path: string;
  type: string;
  defaultValue: string;
  description: string;
};

export function getHelmValuesDocs(): HelmValueDoc[] {
  const docsContent = fs.readFileSync(customizationDocsPath, "utf-8");
  const section = getSection(docsContent, tableHeading);
  const rows = section
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith("|"))
    .filter(line => !line.includes("---"));

  const [, ...bodyRows] = rows;

  return bodyRows.map(parseHelmValuesRow);
}

function getSection(content: string, heading: string): string {
  const start = content.indexOf(heading);
  if (start === -1) {
    throw new Error(`Documentation section '${heading}' not found.`);
  }

  const sectionStart = start + heading.length;
  const nextHeading = content.slice(sectionStart).search(/\n###+\s/);
  return nextHeading === -1
    ? content.slice(sectionStart)
    : content.slice(sectionStart, sectionStart + nextHeading);
}

function parseHelmValuesRow(row: string): HelmValueDoc {
  const [, pathCell, typeCell, defaultCell, descriptionCell] = row
    .split("|")
    .map(cell => cell.trim());

  if (!pathCell || !typeCell || !defaultCell || !descriptionCell) {
    throw new Error(`Invalid Helm values documentation row: ${row}`);
  }

  return {
    path: stripCodeTicks(pathCell),
    type: stripCodeTicks(typeCell),
    defaultValue: stripCodeTicks(defaultCell),
    description: descriptionCell,
  };
}

function stripCodeTicks(value: string): string {
  return value.replace(/^`/, "").replace(/`$/, "");
}
