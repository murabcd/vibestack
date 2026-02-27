const DEFAULT_REDIRECT = "/";

export function sanitizeRedirectPath(input?: string | null): string {
	if (!input) {
		return DEFAULT_REDIRECT;
	}

	// Guard against protocol-relative targets and Windows-style/backslash tricks
	// before URL normalization can reinterpret them.
	if (input.startsWith("//") || input.includes("\\")) {
		return DEFAULT_REDIRECT;
	}

	try {
		// Parse against a safe origin to normalize edge cases.
		const url = new URL(input, "http://local");
		const isRelative = !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(input);

		if (!isRelative) {
			return DEFAULT_REDIRECT;
		}

		if (!url.pathname.startsWith("/") || url.pathname.startsWith("//")) {
			return DEFAULT_REDIRECT;
		}

		if (url.pathname.includes("\\")) {
			return DEFAULT_REDIRECT;
		}

		return `${url.pathname}${url.search}${url.hash}`;
	} catch {
		return DEFAULT_REDIRECT;
	}
}
