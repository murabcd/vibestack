const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isPrivateIpv4(hostname: string): boolean {
	const octets = hostname.split(".").map((part) => Number.parseInt(part, 10));
	if (
		octets.length !== 4 ||
		octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)
	) {
		return false;
	}

	const [a, b] = octets;
	return (
		a === 10 ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168) ||
		a === 127 ||
		(a === 169 && b === 254)
	);
}

export function validateRemoteMcpUrl(
	rawUrl: string,
): { valid: true } | { valid: false; reason: string } {
	let parsed: URL;
	try {
		parsed = new URL(rawUrl);
	} catch {
		return { valid: false, reason: "Invalid URL" };
	}

	if (parsed.protocol !== "https:") {
		return { valid: false, reason: "Only https URLs are allowed" };
	}

	if (parsed.username || parsed.password) {
		return {
			valid: false,
			reason: "Embedded credentials in URL are not allowed",
		};
	}

	const hostname = parsed.hostname.toLowerCase();
	if (LOOPBACK_HOSTS.has(hostname) || hostname.endsWith(".local")) {
		return { valid: false, reason: "Local network hosts are not allowed" };
	}

	if (isPrivateIpv4(hostname)) {
		return {
			valid: false,
			reason: "Private network IP ranges are not allowed",
		};
	}

	if (hostname.includes(":")) {
		return {
			valid: false,
			reason: "IPv6 hosts are not allowed for remote MCP",
		};
	}

	return { valid: true };
}

export function isLocalMcpEnabled(): boolean {
	return process.env.NODE_ENV !== "production";
}

export function validateLocalMcpCommand(
	command: string,
): { valid: true } | { valid: false; reason: string } {
	if (!isLocalMcpEnabled()) {
		return {
			valid: false,
			reason: "Local MCP connectors are disabled in production",
		};
	}

	const [binary] = command.trim().split(/\s+/, 1);
	if (!binary) {
		return { valid: false, reason: "Command is required" };
	}

	return { valid: true };
}
