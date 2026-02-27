import { Sandbox } from "@vercel/sandbox";
import { type NextRequest, NextResponse } from "next/server";
import z from "zod/v3";
import { createApiWideEvent } from "@/lib/logging/wide-event";
import { getSandboxConfig } from "@/lib/sandbox/config";
import { authorizeSandboxOwner } from "../../_auth";

const LspRequestSchema = z.object({
	method: z.literal("textDocument/definition"),
	filename: z.string().min(1),
	position: z.object({
		line: z.number().int().min(0),
		character: z.number().int().min(0),
	}),
});

const lspHelperScript = `import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

const [, , fileArg = "", lineArg = "0", characterArg = "0"] = process.argv;
const line = Number(lineArg) || 0;
const character = Number(characterArg) || 0;

function findTsconfig(startDir) {
  let current = startDir;
  while (current !== path.dirname(current)) {
    const candidate = path.join(current, "tsconfig.json");
    if (fs.existsSync(candidate)) return candidate;
    current = path.dirname(current);
  }
  return null;
}

const cwd = process.cwd();
const tsconfigPath = findTsconfig(cwd);
if (!tsconfigPath) {
  console.log(JSON.stringify({ definitions: [] }));
  process.exit(0);
}

const configDir = path.dirname(tsconfigPath);
const fullPath = path.resolve(configDir, fileArg.replace(/^\\/+/, ""));
if (!fs.existsSync(fullPath)) {
  console.log(JSON.stringify({ definitions: [] }));
  process.exit(0);
}

const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, configDir);
const scriptFileNames = Array.from(new Set([...parsed.fileNames, fullPath]));

const host = {
  getScriptFileNames: () => scriptFileNames,
  getScriptVersion: () => "1",
  getScriptSnapshot: (fileName) => {
    if (!fs.existsSync(fileName)) return undefined;
    return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName, "utf8"));
  },
  getCurrentDirectory: () => configDir,
  getCompilationSettings: () => parsed.options,
  getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
  directoryExists: ts.sys.directoryExists,
  getDirectories: ts.sys.getDirectories,
};

const service = ts.createLanguageService(host, ts.createDocumentRegistry());
const program = service.getProgram();
if (!program) {
  console.log(JSON.stringify({ definitions: [] }));
  process.exit(0);
}

const sourceFile = program.getSourceFile(fullPath);
if (!sourceFile) {
  console.log(JSON.stringify({ definitions: [] }));
  process.exit(0);
}

const offset = ts.getPositionOfLineAndCharacter(sourceFile, line, character);
const definitions = service.getDefinitionAtPosition(fullPath, offset) ?? [];

const result = definitions.map((def) => {
  const defSource = program.getSourceFile(def.fileName);
  if (!defSource) return null;
  const start = ts.getLineAndCharacterOfPosition(defSource, def.textSpan.start);
  const end = ts.getLineAndCharacterOfPosition(defSource, def.textSpan.start + def.textSpan.length);
  return {
    uri: "file://" + def.fileName,
    range: {
      start,
      end,
    },
  };
}).filter(Boolean);

console.log(JSON.stringify({ definitions: result }));
`;

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ sandboxId: string }> },
) {
	const wide = createApiWideEvent(request, "sandboxes.lsp.definition");
	try {
		const [{ sandboxId }, body] = await Promise.all([params, request.json()]);
		const authz = await authorizeSandboxOwner(request, sandboxId);
		if (!authz.ok) {
			wide.end(
				authz.response.status,
				"error",
				new Error("Sandbox access denied"),
			);
			return authz.response;
		}
		const parsed = LspRequestSchema.safeParse(body);
		if (parsed.success === false) {
			wide.end(400, "error", new Error("Invalid LSP request body"));
			return NextResponse.json(
				{ error: "Invalid request body for LSP definition lookup" },
				{ status: 400 },
			);
		}

		const normalizedFilename = parsed.data.filename.startsWith("/")
			? parsed.data.filename
			: `/${parsed.data.filename}`;
		wide.add({
			sandbox_id: sandboxId,
			file_path: normalizedFilename,
		});

		const config = getSandboxConfig();
		const sandbox = await Sandbox.get({
			sandboxId,
			...config,
		});

		const helperPath = ".vibestack-lsp-helper.mjs";
		await sandbox.writeFiles([
			{
				path: helperPath,
				content: Buffer.from(lspHelperScript, "utf8"),
			},
		]);

		const result = await sandbox.runCommand("node", [
			helperPath,
			normalizedFilename,
			String(parsed.data.position.line),
			String(parsed.data.position.character),
		]);

		const [stdout, stderr] = await Promise.all([
			result.stdout(),
			result.stderr(),
		]);
		await sandbox.runCommand("rm", ["-f", helperPath]);

		if (result.exitCode !== 0) {
			wide.end(200, "success");
			return NextResponse.json({
				definitions: [],
				error: stderr || "Definition lookup failed",
			});
		}

		try {
			const payload = JSON.parse(stdout.trim() || "{}");
			wide.end(200, "success");
			return NextResponse.json(payload);
		} catch {
			wide.end(200, "success");
			return NextResponse.json({
				definitions: [],
				error: "Failed to parse LSP response",
			});
		}
	} catch (error) {
		wide.end(500, "error", error);
		return NextResponse.json(
			{ definitions: [], error: "Failed to process LSP request" },
			{ status: 500 },
		);
	}
}
