"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Icons } from "@/components/icons/icons";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
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

export function ImportFromGithubDialog({
	open,
	onOpenChange,
}: ImportFromGithubDialogProps) {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);
	const [isImporting, setIsImporting] = useState(false);
	const [repos, setRepos] = useState<Repo[]>([]);
	const [search, setSearch] = useState("");
	const [repoUrlInput, setRepoUrlInput] = useState("");
	const [importingRepo, setImportingRepo] = useState<string | null>(null);
	const [reposError, setReposError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;

		let cancelled = false;
		setIsLoading(true);
		setReposError(null);
		void fetch("/api/github/repos", { cache: "no-store" })
			.then(async (response) => {
				const json = (await response.json().catch(() => null)) as {
					error?: string;
					repos?: Repo[];
				} | null;

				if (cancelled) return;
				if (!response.ok) {
					const message = json?.error ?? "Failed to load GitHub repositories";
					setReposError(message);
					toast.error(message);
					return;
				}

				setRepos(json?.repos ?? []);
			})
			.catch(() => {
				if (!cancelled) {
					setReposError("Failed to load GitHub repositories");
					toast.error("Failed to load GitHub repositories");
				}
			})
			.finally(() => {
				if (!cancelled) {
					setIsLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [open]);

	const filteredRepos = useMemo(() => {
		const query = search.trim().toLowerCase();
		return repos.filter((repo) => {
			if (!query) return true;
			return (
				repo.fullName.toLowerCase().includes(query) ||
				repo.name.toLowerCase().includes(query)
			);
		});
	}, [repos, search]);

	const importRepository = async (repository: string) => {
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
			onOpenChange(false);
			router.push(`/project/${json.projectId}`);
		} catch {
			toast.error("Failed to import repository");
		} finally {
			setIsImporting(false);
			setImportingRepo(null);
		}
	};

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

				<div className="px-6 pb-6 space-y-3">
					<div className="space-y-2">
						<Label htmlFor="github-import-url">Import from a URL</Label>
						<div className="flex gap-2">
							<Input
								id="github-import-url"
								value={repoUrlInput}
								onChange={(event) => setRepoUrlInput(event.target.value)}
								placeholder="https://github.com/owner/repo"
								disabled={isImporting}
							/>
							<Button
								type="button"
								onClick={() => {
									if (!repoUrlInput.trim()) return;
									void importRepository(repoUrlInput.trim());
								}}
								disabled={isImporting || !repoUrlInput.trim()}
								className="px-5 cursor-pointer"
							>
								Import
							</Button>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="github-search-repos">Search repositories</Label>
						<div className="relative">
							<Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
							<Input
								id="github-search-repos"
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								placeholder="Find repositories by name…"
								className="pl-9"
								disabled={isLoading || isImporting}
							/>
						</div>
					</div>

					{reposError ? (
						<div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
							{reposError}
						</div>
					) : null}

					<div className="rounded-md border overflow-hidden">
						<ScrollArea className="h-[260px]">
							{isLoading ? (
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
							) : filteredRepos.length === 0 ? (
								<div className="p-3 text-sm text-muted-foreground">
									No repositories found.
								</div>
							) : (
								<ul>
									{filteredRepos.map((repo) => (
										<li
											key={repo.id}
											className="flex items-center justify-between px-3 py-2.5 border-b last:border-b-0"
										>
											<div className="min-w-0 flex items-center gap-2">
												<div className="size-6 rounded-full border grid place-items-center shrink-0">
													<Icons.gitHub className="size-3.5 p-0" />
												</div>
												<div className="min-w-0">
													<div className="text-sm font-medium truncate">
														{repo.name}
													</div>
													<div className="text-xs text-muted-foreground truncate">
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
												className="cursor-pointer"
											>
												{isImporting && importingRepo === repo.fullName
													? "Importing..."
													: "Import"}
											</Button>
										</li>
									))}
								</ul>
							)}
						</ScrollArea>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
