export interface Session {
	created: number;
	authProvider: "github";
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
