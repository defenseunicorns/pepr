import fs from "fs";
import path from "path";
import ts from "typescript";
import Log from "../../../lib/telemetry/logger";
import { stringify } from "yaml";
import { createDirectoryIfNotExists } from "../../../lib/filesystemService";
import { kind as k } from "kubernetes-fluent-client";
import { V1JSONSchemaProps } from "@kubernetes/client-node";
import { WarningMessages, ErrorMessages } from "./messages";

function extractCRDDetails(
  content: string,
  sourceFile: ts.SourceFile,
): {
  kind: string | undefined;
  fqdn: string;
  scope: "Cluster" | "Namespaced";
  plural: string;
  shortNames?: string[];
} {
  const kind = extractSingleLineComment(content, "Kind");
  const group = extractSingleLineComment(content, "Group") ?? "example";
  const domain = extractSingleLineComment(content, "Domain") ?? "pepr.dev";
  const details = extractDetails(sourceFile);

  const fqdn = `${group}.${domain}`;

  const { plural, scope } = details;

  const shortNames = details.shortName ? [details.shortName] : undefined;
  return { kind, plural, scope, shortNames, fqdn };
}

export async function generateCRDs(options: { output: string }): Promise<void> {
  Log.warn("This feature is currently in alpha.\n");
  const outputDir = path.resolve(options.output);
  await createDirectoryIfNotExists(outputDir);

  const apiRoot = path.resolve("api");
  const versions = getAPIVersions(apiRoot);

  for (const version of versions) {
    const versionDir = path.join(apiRoot, version);
    const filePaths = loadVersionFilePaths(versionDir);
    const program = createProgram(filePaths);
    const checker = program.getTypeChecker();

    for (const filePath of filePaths) {
      const sourceFile = program.getSourceFile(filePath);
      if (sourceFile) {
        processSourceFile(sourceFile, checker, version, outputDir);
      }
    }
  }
}

export function getAPIVersions(apiRoot: string): string[] {
  return fs.readdirSync(apiRoot).filter(v => fs.statSync(path.join(apiRoot, v)).isDirectory());
}

export function loadVersionFilePaths(versionDir: string): string[] {
  const files = fs.readdirSync(versionDir).filter(f => f.endsWith(".ts"));
  return files.map(f => path.join(versionDir, f));
}

export function createProgram(filePaths: string[]): ts.Program {
  return ts.createProgram(filePaths, {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
  });
}

export function processSourceFile(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  version: string,
  outputDir: string,
): void {
  const content = sourceFile.getFullText();
  const { kind, fqdn, scope, plural, shortNames } = extractCRDDetails(content, sourceFile);

  if (!kind) {
    Log.warn(WarningMessages.MISSING_KIND_COMMENT(path.basename(sourceFile.fileName)));
    return;
  }

  const spec = findInterface(sourceFile, `${kind}Spec`);
  if (!spec) {
    Log.warn(WarningMessages.MISSING_INTERFACE(path.basename(sourceFile.fileName), kind));
    return;
  }

  const condition = findTypeAlias(sourceFile, `${kind}StatusCondition`);
  const specSchema = getSchemaFromType(spec, checker);
  const conditionSchema = condition ? getSchemaFromType(condition, checker) : emptySchema();

  const crd = buildCRD({
    kind,
    fqdn,
    version,
    plural,
    scope,
    shortNames,
    specSchema,
    conditionSchema,
  });

  const outPath = path.join(outputDir, `${kind.toLowerCase()}.yaml`);
  fs.writeFileSync(outPath, stringify(crd), "utf8");
  Log.info(`✔ Created ${outPath}`);
}

// Extracts a comment from the content of a file based on a label.
export function extractSingleLineComment(content: string, label: string): string | undefined {
  // https://regex101.com/r/oLFaHP/1
  const match = content.match(new RegExp(`//\\s+${label}:\\s+(.*)`));
  return match?.[1].trim();
}

export function extractDetails(sourceFile: ts.SourceFile): {
  plural: string;
  scope: "Cluster" | "Namespaced";
  shortName: string;
} {
  let detailsDecl: ts.VariableDeclaration | undefined;
  ts.forEachChild(sourceFile, node => {
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === "details") {
          detailsDecl = decl;
        }
      }
    }
  });

  if (!detailsDecl) {
    throw new Error(ErrorMessages.MISSING_DETAILS);
  }

  const init = detailsDecl.initializer;
  if (!init || !ts.isObjectLiteralExpression(init)) {
    throw new Error(ErrorMessages.MISSING_DETAILS);
  }

  const getStr = (key: string): string => {
    const match = init.properties.find(
      (prop): prop is ts.PropertyAssignment =>
        ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === key,
    );

    if (match && ts.isStringLiteral(match.initializer) && match.initializer.text) {
      return match.initializer.text;
    }
    throw new Error(ErrorMessages.MISSING_OR_INVALID_KEY(key));
  };

  const scope = getStr("scope");
  if (scope === "Cluster" || scope === "Namespaced") {
    return {
      plural: getStr("plural"),
      scope,
      shortName: getStr("shortName"),
    };
  }

  throw new Error(ErrorMessages.INVALID_SCOPE(scope));
}

function findInterface(
  sourceFile: ts.SourceFile,
  name: string,
): ts.InterfaceDeclaration | undefined {
  let result: ts.InterfaceDeclaration | undefined;
  ts.forEachChild(sourceFile, node => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === name) {
      result = node;
    }
  });
  return result;
}

function findTypeAlias(
  sourceFile: ts.SourceFile,
  name: string,
): ts.TypeAliasDeclaration | undefined {
  let result: ts.TypeAliasDeclaration | undefined;
  ts.forEachChild(sourceFile, node => {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === name) {
      result = node;
    }
  });
  return result;
}

function getJsDocDescription(node: ts.Node): string {
  const jsDocs = (node as { jsDoc?: ts.JSDoc[] }).jsDoc;
  if (!jsDocs) return "";
  const comments: string[] = [];
  for (const doc of jsDocs) {
    if (doc.comment) {
      if (typeof doc.comment === "string") {
        comments.push(doc.comment);
      } else {
        comments.push(doc.comment.map(part => part.text).join(""));
      }
    }
  }
  return comments.join(" ").trim();
}

function getSchemaFromType(
  decl: ts.InterfaceDeclaration | ts.TypeAliasDeclaration,
  checker: ts.TypeChecker,
): {
  properties: Record<string, V1JSONSchemaProps>;
  required: string[];
} {
  const type = checker.getTypeAtLocation(decl);
  const properties: Record<string, V1JSONSchemaProps> = {};
  const required: string[] = [];

  for (const prop of type.getProperties()) {
    const name = uncapitalize(prop.getName());
    const declarations = prop.getDeclarations();
    if (!declarations || !declarations.length) continue;

    const declaration = declarations[0];
    const description = getJsDocDescription(declaration);
    const valueType = checker.getTypeOfSymbolAtLocation(prop, declaration);

    properties[name] = {
      ...mapTypeToSchema(valueType, checker),
      ...(description ? { description } : {}),
    };

    if (!(prop.flags & ts.SymbolFlags.Optional)) required.push(name);
  }

  return { properties, required };
}

function getPrimitiveSchemaType(type: ts.Type): V1JSONSchemaProps | undefined {
  const { flags } = type;
  if (flags & ts.TypeFlags.String || flags & ts.TypeFlags.StringLiteral) {
    return { type: "string" };
  }
  if (flags & ts.TypeFlags.Number || flags & ts.TypeFlags.NumberLiteral) {
    return { type: "number" };
  }
  if (
    flags & ts.TypeFlags.Boolean ||
    flags & ts.TypeFlags.BooleanLiteral ||
    flags & ts.TypeFlags.BooleanLike
  ) {
    return { type: "boolean" };
  }
  return undefined;
}

function mapTypeToSchema(type: ts.Type, checker: ts.TypeChecker): V1JSONSchemaProps {
  if (checker.typeToString(type) === "Date") return { type: "string", format: "date-time" };

  const primitive = getPrimitiveSchemaType(type);
  if (primitive) return primitive;

  if (checker.isArrayType(type)) {
    const typeArgs = checker.getTypeArguments(type as ts.TypeReference);
    if (typeArgs && typeArgs.length > 0) {
      return { type: "array", items: mapTypeToSchema(typeArgs[0], checker) };
    }
    return { type: "array" };
  }

  if (type.flags & ts.TypeFlags.Object) return buildObjectSchema(type, checker);
  return { type: "string" };
}

function buildObjectSchema(type: ts.Type, checker: ts.TypeChecker): V1JSONSchemaProps {
  const props: Record<string, V1JSONSchemaProps> = {};
  const required: string[] = [];

  for (const prop of type.getProperties()) {
    const name = uncapitalize(prop.getName());
    const declarations = prop.getDeclarations();
    if (!declarations || !declarations.length) continue;

    const decl = declarations[0];
    const description = getJsDocDescription(decl);
    const subType = checker.getTypeOfSymbolAtLocation(prop, decl);

    props[name] = {
      ...mapTypeToSchema(subType, checker),
      ...(description ? { description } : {}),
    };

    if (!(prop.flags & ts.SymbolFlags.Optional)) required.push(name);
  }

  return {
    type: "object",
    properties: props,
    ...(required.length > 0 ? { required } : {}),
  };
}

export function uncapitalize(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

export function emptySchema(): {
  properties: Record<string, V1JSONSchemaProps>;
  required: string[];
} {
  return { properties: {}, required: [] };
}

interface CRDConfig {
  kind: string;
  fqdn: string;
  version: string;
  plural: string;
  scope: "Cluster" | "Namespaced";
  shortNames?: string[];
  specSchema: ReturnType<typeof getSchemaFromType>;
  conditionSchema: ReturnType<typeof getSchemaFromType>;
}

function buildCRD(config: CRDConfig): k.CustomResourceDefinition {
  return {
    apiVersion: "apiextensions.k8s.io/v1",
    kind: "CustomResourceDefinition",
    metadata: {
      name: `${config.plural}.${config.fqdn}`,
    },
    spec: {
      group: config.fqdn,
      names: {
        kind: config.kind,
        plural: config.plural,
        singular: config.kind.toLowerCase(),
        ...(config.shortNames ? { shortNames: config.shortNames } : {}),
      },
      scope: config.scope,
      versions: [
        {
          name: config.version,
          served: true,
          storage: true,
          schema: {
            openAPIV3Schema: {
              type: "object",
              properties: {
                spec: {
                  type: "object",
                  description: `${config.kind}Spec defines the desired state of ${config.kind}`,
                  properties: config.specSchema.properties,
                  required: config.specSchema.required,
                },
                status: {
                  type: "object",
                  description: `${config.kind}Status defines the observed state of ${config.kind}`,
                  properties: {
                    conditions: {
                      type: "array",
                      description: "Conditions describing the current state",
                      items: {
                        type: "object",
                        description:
                          "Condition contains details for one aspect of the current state of this API Resource.",
                        properties: config.conditionSchema.properties,
                        required: config.conditionSchema.required,
                      },
                    },
                  },
                },
              },
            },
          },
          subresources: {
            status: {},
          },
        },
      ],
    },
  };
}
