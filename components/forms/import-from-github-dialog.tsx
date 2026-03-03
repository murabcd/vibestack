"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Icons } from "@/components/icons/icons";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppHaptics } from "@/hooks/use-app-haptics";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "../ui/button";

type Repo = {
	id: number;
	name: string;
	fullName: string;
	private: boolean;
	htmlUrl: string;
	updatedAt: string;
	owner: string;
	ownerAvatarUrl?: string;
};

interface ImportFromGithubDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

function formatDate(dateValue: string) {
	const date = new Date(dateValue);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "2-digit",
	});
}

function parseGitHubRepositoryInput(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) return null;

	const fullNameMatch = trimmed.match(/^([\w.-]+)\/([\w.-]+)$/);
	if (fullNameMatch) {
		return `${fullNameMatch[1]}/${fullNameMatch[2].replace(/\.git$/, "")}`;
	}

	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		return null;
	}

	const host = url.hostname.toLowerCase();
	if (host !== "github.com" && host !== "www.github.com") {
		return null;
	}

	const [owner, repo] = url.pathname.replace(/^\/+/, "").split("/");
	if (!owner || !repo) return null;
	return `${owner}/${repo.replace(/\.git$/, "")}`;
}

async function fetchReposWithRetry(): Promise<
	| {
			ok: true;
			repos: Repo[];
	  }
	| { ok: false; message: string }
> {
	const maxAttempts = 2;
	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			const response = await fetch("/api/github/repos", { cache: "no-store" });
			const json = (await response.json().catch(() => null)) as {
				error?: string;
				repos?: Repo[];
			} | null;

			if (response.ok) {
				return { ok: true, repos: json?.repos ?? [] };
			}

			const message = json?.error ?? "Failed to load GitHub repositories";
			const retryable = response.status >= 500 && response.status < 600;
			if (attempt < maxAttempts && retryable) {
				await new Promise((resolve) => setTimeout(resolve, attempt * 250));
				continue;
			}

			return { ok: false, message };
		} catch {
			if (attempt < maxAttempts) {
				await new Promise((resolve) => setTimeout(resolve, attempt * 250));
				continue;
			}
			return { ok: false, message: "Failed to load GitHub repositories" };
		}
	}

	return { ok: false, message: "Failed to load GitHub repositories" };
}

export function ImportFromGithubDialog({
	open,
	onOpenChange,
}: ImportFromGithubDialogProps) {
	const router = useRouter();
	const isMobile = useIsMobile();
	const [isLoading, setIsLoading] = useState(false);
	const [isImporting, setIsImporting] = useState(false);
	const [isSearching, setIsSearching] = useState(false);
	const [repos, setRepos] = useState<Repo[]>([]);
	const [searchRepos, setSearchRepos] = useState<Repo[]>([]);
	const [queryInput, setQueryInput] = useState("");
	const [importingRepo, setImportingRepo] = useState<string | null>(null);
	const [reposError, setReposError] = useState<string | null>(null);
	const {
		selection,
		success: successHaptic,
		error: errorHaptic,
	} = useAppHaptics();
	const errorHapticRef = useRef(errorHaptic);

	useEffect(() => {
		errorHapticRef.current = errorHaptic;
	}, [errorHaptic]);

	useEffect(() => {
		if (!open) return;

		let cancelled = false;
		setIsLoading(true);
		setReposError(null);
		void fetchReposWithRetry().then((result) => {
			if (cancelled) return;

			if (!result.ok) {
				setReposError(result.message);
				toast.error(result.message);
				errorHapticRef.current();
				setIsLoading(false);
				return;
			}

			setRepos(result.repos);
			setIsLoading(false);
		});

		return () => {
			cancelled = true;
		};
	}, [open]);

	const directImportCandidate = useMemo(
		() => parseGitHubRepositoryInput(queryInput),
		[queryInput],
	);
	const trimmedQuery = queryInput.trim();
	const lowerQuery = trimmedQuery.toLowerCase();

	const filteredOwnedRepos = useMemo(() => {
		if (!lowerQuery) return repos;
		return repos.filter((repo) => {
			return (
				repo.fullName.toLowerCase().includes(lowerQuery) ||
				repo.name.toLowerCase().includes(lowerQuery) ||
				repo.htmlUrl.toLowerCase().includes(lowerQuery)
			);
		});
	}, [repos, lowerQuery]);
	const displayedRepos = useMemo(() => {
		const merged =
			trimmedQuery && !directImportCandidate
				? [...filteredOwnedRepos, ...searchRepos]
				: [...filteredOwnedRepos];
		const seen = new Set<string>();
		return merged.filter((repo) => {
			const key = repo.fullName.toLowerCase();
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}, [filteredOwnedRepos, searchRepos, trimmedQuery, directImportCandidate]);

	useEffect(() => {
		const query = trimmedQuery;
		if (!query || directImportCandidate) {
			setSearchRepos([]);
			setIsSearching(false);
			return;
		}

		let cancelled = false;
		const timeout = window.setTimeout(async () => {
			setIsSearching(true);
			try {
				const response = await fetch(
					`/api/github/repos?q=${encodeURIComponent(query)}`,
					{ cache: "no-store" },
				);
				const json = (await response.json().catch(() => null)) as {
					error?: string;
					repos?: Repo[];
				} | null;
				if (cancelled) return;
				if (!response.ok) {
					setSearchRepos([]);
					return;
				}
				setSearchRepos(json?.repos ?? []);
			} catch {
				if (!cancelled) {
					setSearchRepos([]);
				}
			} finally {
				if (!cancelled) {
					setIsSearching(false);
				}
			}
		}, 250);

		return () => {
			cancelled = true;
			window.clearTimeout(timeout);
		};
	}, [trimmedQuery, directImportCandidate]);

	const importRepository = async (repository: string) => {
		selection();
		setIsImporting(true);
		setImportingRepo(repository);
		try {
			const response = await fetch("/api/projects/import/github", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ repository, visibility: "private" }),
			});

			const json = (await response.json().catch(() => null)) as {
				error?: string;
				projectId?: string;
				repoFullName?: string;
				paths?: string[];
				sandboxId?: string;
				previewUrl?: string;
			} | null;

			if (!response.ok || !json?.projectId) {
				toast.error(json?.error ?? "Failed to import repository");
				errorHaptic();
				return;
			}

			sessionStorage.setItem(
				`imported-project-state-${json.projectId}`,
				JSON.stringify({
					sandboxId: json.sandboxId,
					url: json.previewUrl,
					paths: json.paths ?? [],
				}),
			);

			toast.success(`Imported ${json.repoFullName ?? repository}`);
			successHaptic();
			onOpenChange(false);
			router.push(`/project/${json.projectId}`);
		} catch {
			toast.error("Failed to import repository");
			errorHaptic();
		} finally {
			setIsImporting(false);
			setImportingRepo(null);
		}
	};

	const content = (
		<div className="space-y-3">
			<div className="space-y-2">
				<Label htmlFor="github-search-or-import">
					Search repos or paste link
				</Label>
				<Input
					id="github-search-or-import"
					value={queryInput}
					onChange={(event) => setQueryInput(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter" && directImportCandidate) {
							event.preventDefault();
							void importRepository(directImportCandidate);
						}
					}}
					placeholder="owner/repo, https://github.com/owner/repo, or name"
					disabled={isImporting}
				/>
			</div>

			{reposError ? (
				<div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
					{reposError}
				</div>
			) : null}

			<div className="rounded-md border overflow-hidden">
				<ScrollArea className="h-[260px]">
					{isLoading ||
					(trimmedQuery && !directImportCandidate && isSearching) ? (
						<ul className="p-3 space-y-2">
							{[
								"skeleton-1",
								"skeleton-2",
								"skeleton-3",
								"skeleton-4",
								"skeleton-5",
								"skeleton-6",
							].map((key) => (
								<li
									key={key}
									className="flex items-center justify-between gap-2 rounded-md border px-3 py-2.5"
								>
									<div className="flex items-center gap-2 min-w-0 flex-1">
										<Skeleton className="size-6 rounded-full shrink-0" />
										<div className="space-y-1.5 min-w-0 flex-1">
											<Skeleton className="h-4 w-32" />
											<Skeleton className="h-3 w-44" />
										</div>
									</div>
									<Skeleton className="h-8 w-16 shrink-0" />
								</li>
							))}
						</ul>
					) : (
						<>
							{directImportCandidate ? (
								<ul className="border-b">
									<li className="flex items-center gap-2 px-3 py-2.5">
										<div className="min-w-0 w-0 flex flex-1 items-center gap-2 overflow-hidden">
											<div className="size-6 rounded-full border grid place-items-center shrink-0">
												<Icons.gitHub className="size-3.5 p-0" />
											</div>
											<div className="min-w-0 w-0 flex-1">
												<div
													className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium"
													title={directImportCandidate}
												>
													{directImportCandidate}
												</div>
												<div className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground">
													Direct import target from URL/owner-repo
												</div>
											</div>
										</div>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() =>
												void importRepository(directImportCandidate)
											}
											disabled={isImporting}
											className="cursor-pointer shrink-0 ml-2"
										>
											{isImporting && importingRepo === directImportCandidate
												? "Importing..."
												: "Import"}
										</Button>
									</li>
								</ul>
							) : null}
							{displayedRepos.length === 0 ? (
								directImportCandidate ? null : (
									<div className="h-[260px] grid place-items-center px-3 text-sm text-muted-foreground">
										No repositories found.
									</div>
								)
							) : (
								<ul>
									{displayedRepos.map((repo) => (
										<li
											key={trimmedQuery ? `query-${repo.id}` : `${repo.id}`}
											className="flex items-center gap-2 px-3 py-2.5 border-b last:border-b-0"
										>
											<div className="min-w-0 w-0 flex flex-1 items-center gap-2 overflow-hidden">
												<div className="size-6 rounded-full border grid place-items-center shrink-0">
													<Icons.gitHub className="size-3.5 p-0" />
												</div>
												<div className="min-w-0 w-0 flex-1">
													<div
														className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium"
														title={trimmedQuery ? repo.fullName : repo.name}
													>
														{trimmedQuery ? repo.fullName : repo.name}
													</div>
													<div
														className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground"
														title={`${repo.owner} · ${formatDate(repo.updatedAt)}${repo.private ? " · Private" : " · Public"}`}
													>
														{repo.owner} · {formatDate(repo.updatedAt)}
														{repo.private ? " · Private" : " · Public"}
													</div>
												</div>
											</div>
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => void importRepository(repo.fullName)}
												disabled={isImporting}
												className="cursor-pointer shrink-0 ml-2"
											>
												{isImporting && importingRepo === repo.fullName
													? "Importing..."
													: "Import"}
											</Button>
										</li>
									))}
								</ul>
							)}
						</>
					)}
				</ScrollArea>
			</div>
		</div>
	);

	if (isMobile) {
		return (
			<Drawer open={open} onOpenChange={onOpenChange}>
				<DrawerContent className="max-h-[85vh]">
					<DrawerHeader>
						<DrawerTitle>Import from GitHub</DrawerTitle>
						<DrawerDescription>
							Select one of your repositories or paste a GitHub URL.
						</DrawerDescription>
					</DrawerHeader>
					<div className="overflow-y-auto p-4 pt-0">{content}</div>
				</DrawerContent>
			</Drawer>
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg p-0 overflow-hidden">
				<div className="p-6 pb-3">
					<DialogHeader>
						<DialogTitle>Import from GitHub</DialogTitle>
						<DialogDescription>
							Select one of your repositories or paste a GitHub URL.
						</DialogDescription>
					</DialogHeader>
				</div>
				<div className="px-6 pb-6">{content}</div>
			</DialogContent>
		</Dialog>
	);
}
