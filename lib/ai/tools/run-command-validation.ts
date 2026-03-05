export function getCommandValidationError(
	command: string,
	args: string[] = [],
): string | null {
	const trimmed = command.trim();
	if (!trimmed) {
		return "Command cannot be empty.";
	}
	if (/\s/.test(trimmed)) {
		return "Command must be a single executable without spaces. Put flags in args.";
	}
	if (/[|;&`$()<>]/.test(trimmed)) {
		return "Command contains unsupported shell control characters.";
	}

	const lowerCommand = trimmed.toLowerCase();

	// Never allow destructive host/system level operations in sandbox tooling.
	if (
		[
			"dd",
			"mkfs",
			"fdisk",
			"shutdown",
			"reboot",
			"poweroff",
			"halt",
			"killall",
		].includes(lowerCommand)
	) {
		return `Command \`${trimmed}\` is blocked for safety.`;
	}

	if (lowerCommand === "git") {
		return null;
	}

	if (lowerCommand === "rm") {
		const targets = args.filter((arg) => !arg.startsWith("-"));
		const dangerousTarget = targets.some((target) => {
			const normalized = target.trim().toLowerCase();
			return normalized === "/" || normalized === "/*";
		});

		if (dangerousTarget) {
			return "Command targeting filesystem root is blocked for safety.";
		}
	}

	return null;
}

export function needsCommandApproval(
	command: string,
	args: string[] = [],
): boolean {
	const lowerCommand = command.trim().toLowerCase();
	const lowerArgs = args.map((arg) => arg.toLowerCase());

	if (lowerCommand === "rm") {
		const hasRecursive = lowerArgs.some(
			(arg) =>
				arg === "-r" || arg === "-rf" || arg === "-fr" || arg === "--recursive",
		);
		const hasForce = lowerArgs.some(
			(arg) => arg === "-f" || arg === "-rf" || arg === "-fr",
		);
		return hasRecursive || hasForce;
	}

	if (lowerCommand === "git") {
		const sub = lowerArgs[0] ?? "";
		if (sub === "reset" && lowerArgs.includes("--hard")) return true;
		if (
			sub === "clean" &&
			lowerArgs.some((arg) => arg === "-f" || arg.startsWith("-f"))
		) {
			return true;
		}
		if (sub === "checkout" && lowerArgs.includes("--")) return true;
		if (sub === "restore") return true;
	}

	return false;
}
