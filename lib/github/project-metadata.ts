export type ProjectGitHubSource = {
	provider: "github";
	owner: string;
	repo: string;
	fullName: string;
	defaultBranch?: string;
	importedAt: string;
};

export type ProjectGitHubPullRequest = {
	number: number;
	url: string;
	branch: string;
	baseBranch: string;
	title: string;
	createdAt: string;
};

export type ProjectGitHubMetadata = {
	source?: ProjectGitHubSource;
	workingBranch?: string | null;
	lastSyncedAt?: string | null;
	lastPullRequest?: ProjectGitHubPullRequest | null;
};
