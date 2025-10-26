export interface Session {
	created: number;
	authProvider: "github" | "vercel";
	user: {
		id: string; // Internal user ID
		username: string;
		email?: string;
		name?: string;
		avatar?: string;
	};
}

export interface Tokens {
	accessToken: string;
	refreshToken?: string;
}
