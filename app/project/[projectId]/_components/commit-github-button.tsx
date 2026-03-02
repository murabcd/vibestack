"use client";

import { GitBranch, Loader2, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Icons } from "@/components/icons/icons";
import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAppHaptics } from "@/hooks/use-app-haptics";

interface CommitGitHubButtonProps {
	projectId: string;
	projectTitle?: string | null;
}

type Visibility = "public" | "private";

type GitHubSourceResponse = {
	imported: boolean;
	repository?: {
		owner: string;
		repo: string;
		fullName: string;
	};
	hasChanges?: boolean;
	baseBranch?: string;
	workingBranch?: string | null;
	lastSyncedAt?: string | null;
	lastPullRequest?: {
		number: number;
		url: string;
		branch: string;
		baseBranch: string;
		title: string;
		createdAt: string;
	} | null;
	error?: string;
};

function toRepoName(
	projectTitle: string | null | undefined,
	projectId: string,
) {
	const source = projectTitle?.trim() || `vibestack-${projectId.slice(0, 6)}`;
	const value = source
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
	return value || `vibestack-${projectId.slice(0, 6)}`;
}

export function CommitGitHubButton({
	projectId,
	projectTitle,
}: CommitGitHubButtonProps) {
	const defaultRepoName = useMemo(
		() => toRepoName(projectTitle, projectId),
		[projectId, projectTitle],
	);
	const [open, setOpen] = useState(false);
	const [repositoryName, setRepositoryName] = useState(defaultRepoName);
	const [visibility, setVisibility] = useState<Visibility>("private");
	const [isPublishing, setIsPublishing] = useState(false);
	const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
	const [isCheckingSource, setIsCheckingSource] = useState(false);
	const [source, setSource] = useState<GitHubSourceResponse | null>(null);
	const [isCreatingPr, setIsCreatingPr] = useState(false);
	const [pullRequestUrl, setPullRequestUrl] = useState<string | null>(null);
	const [isSyncing, setIsSyncing] = useState(false);
	const [prTitle, setPrTitle] = useState("");
	const [prBody, setPrBody] = useState("");
	const [isMobile, setIsMobile] = useState(false);
	const { selection, success, error } = useAppHaptics();

	useEffect(() => {
		let mounted = true;
		const run = async () => {
			setIsCheckingSource(true);
			try {
				const response = await fetch(
					`/api/projects/${projectId}/github/source`,
					{
						cache: "no-store",
					},
				);
				const json = (await response
					.json()
					.catch(() => null)) as GitHubSourceResponse | null;
				if (!mounted) return;
				if (!response.ok) {
					setSource(null);
					return;
				}
				setSource(json);
			} catch {
				if (mounted) {
					setSource(null);
				}
			} finally {
				if (mounted) {
					setIsCheckingSource(false);
				}
			}
		};
		void run();
		return () => {
			mounted = false;
		};
	}, [projectId]);

	useEffect(() => {
		if (source?.lastPullRequest?.url) {
			setPullRequestUrl(source.lastPullRequest.url);
		}
		if (source?.lastPullRequest?.title) {
			setPrTitle(source.lastPullRequest.title);
		} else if (projectTitle) {
			setPrTitle(`Update ${projectTitle}`);
		}
	}, [source, projectTitle]);

	useEffect(() => {
		const media = window.matchMedia("(max-width: 767px)");
		const update = () => setIsMobile(media.matches);
		update();
		media.addEventListener("change", update);
		return () => media.removeEventListener("change", update);
	}, []);

	const isImportedRepo = source?.imported && !!source.repository;
	const headerTitle = isImportedRepo ? "Create pull request" : "Commit";
	const headerDescription = isImportedRepo
		? `Push your local changes and open a PR in ${source?.repository?.fullName}.`
		: "Create a new repository and push this project.";

	const publishToGitHub = async () => {
		if (!repositoryName.trim()) {
			toast.error("Repository name is required");
			error();
			return;
		}

		selection();
		setIsPublishing(true);
		try {
			const response = await fetch(
				`/api/projects/${projectId}/publish/github`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						repositoryName: repositoryName.trim(),
						visibility,
					}),
				},
			);

			const json = (await response.json().catch(() => null)) as {
				error?: string;
				repository?: { url?: string };
				publishedFiles?: number;
				skippedFiles?: number;
				warnings?: string[];
			} | null;

			if (!response.ok) {
				toast.error(json?.error ?? "Failed to publish to GitHub");
				error();
				return;
			}

			setPublishedUrl(json?.repository?.url ?? null);
			toast.success(
				`Published ${json?.publishedFiles ?? 0} files to GitHub${
					json?.skippedFiles ? ` (${json.skippedFiles} skipped)` : ""
				}`,
			);
			success();
			for (const warning of json?.warnings ?? []) {
				toast.warning(warning);
			}
		} catch {
			toast.error("Failed to publish to GitHub");
			error();
		} finally {
			setIsPublishing(false);
		}
	};

	const syncChanges = async () => {
		selection();
		setIsSyncing(true);
		try {
			const response = await fetch(`/api/projects/${projectId}/github/sync`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({}),
			});
			const json = (await response.json().catch(() => null)) as {
				error?: string;
				branchName?: string;
				hasChanges?: boolean;
			} | null;
			if (!response.ok) {
				toast.error(json?.error ?? "Failed to sync changes");
				error();
				return;
			}
			toast.success(
				json?.hasChanges
					? `Changes synced to ${json.branchName}`
					: "No local changes to sync",
			);
			success();
			const sourceResponse = await fetch(
				`/api/projects/${projectId}/github/source`,
				{
					cache: "no-store",
				},
			);
			const sourceJson = (await sourceResponse
				.json()
				.catch(() => null)) as GitHubSourceResponse | null;
			if (sourceResponse.ok && sourceJson) {
				setSource(sourceJson);
			}
		} catch {
			toast.error("Failed to sync changes");
			error();
		} finally {
			setIsSyncing(false);
		}
	};

	const createPullRequest = async () => {
		selection();
		setIsCreatingPr(true);
		try {
			const response = await fetch(
				`/api/projects/${projectId}/github/create-pr`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						title: prTitle.trim() || undefined,
						body: prBody.trim() || undefined,
					}),
				},
			);

			const json = (await response.json().catch(() => null)) as {
				error?: string;
				pullRequest?: {
					url?: string;
					number?: number;
				};
			} | null;

			if (!response.ok) {
				toast.error(json?.error ?? "Failed to create pull request");
				error();
				return;
			}

			const url = json?.pullRequest?.url ?? null;
			setPullRequestUrl(url);
			toast.success(
				json?.pullRequest?.number
					? `Pull request #${json.pullRequest.number} created`
					: "Pull request created",
			);
			success();
			const sourceResponse = await fetch(
				`/api/projects/${projectId}/github/source`,
				{
					cache: "no-store",
				},
			);
			const sourceJson = (await sourceResponse
				.json()
				.catch(() => null)) as GitHubSourceResponse | null;
			if (sourceResponse.ok && sourceJson) {
				setSource(sourceJson);
			}
		} catch {
			toast.error("Failed to create pull request");
			error();
		} finally {
			setIsCreatingPr(false);
		}
	};

	const panelBody = (
		<div className="space-y-3">
			{isCheckingSource ? (
				<div className="text-xs text-muted-foreground">
					Checking repository link...
				</div>
			) : null}

			{isImportedRepo ? (
				<div className="space-y-2">
					<div className="rounded-md border p-2 text-xs text-muted-foreground">
						<div className="flex items-center gap-1">
							<Icons.gitHub className="size-3.5" />
							<span>{source.repository?.fullName}</span>
						</div>
						<div className="pt-1">
							Base branch: {source.baseBranch || "main"}
						</div>
						<div>
							Working branch: {source.workingBranch || "(not synced yet)"}
						</div>
						<div>
							{source.hasChanges
								? "Detected local changes ready to push."
								: "No local git changes detected."}
						</div>
					</div>
					<div className="space-y-1">
						<Label>PR title</Label>
						<Input
							value={prTitle}
							onChange={(event) => setPrTitle(event.target.value)}
							placeholder="Update project"
							className="h-8 text-xs"
							disabled={isSyncing || isCreatingPr}
						/>
					</div>
					<div className="space-y-1">
						<Label>PR description (optional)</Label>
						<Textarea
							value={prBody}
							onChange={(event) => setPrBody(event.target.value)}
							placeholder="Describe what changed"
							className="min-h-20 text-xs"
							disabled={isSyncing || isCreatingPr}
						/>
					</div>
					{pullRequestUrl ? (
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-full px-2 text-xs gap-1 cursor-pointer"
							onClick={() => {
								selection();
								window.open(pullRequestUrl, "_blank", "noreferrer");
							}}
						>
							<Icons.gitHub className="size-3.5" />
							Open pull request
						</Button>
					) : null}
					<div className="grid grid-cols-2 gap-2">
						<Button
							size="sm"
							variant="outline"
							className="h-8 w-full px-3 text-xs gap-1 cursor-pointer"
							onClick={syncChanges}
							disabled={isSyncing || isCreatingPr}
						>
							{isSyncing ? (
								<>
									<Loader2 className="size-3.5 animate-spin" />
									Syncing...
								</>
							) : (
								<>Sync</>
							)}
						</Button>
						<Button
							size="sm"
							className="h-8 w-full px-3 text-xs gap-1 cursor-pointer"
							onClick={createPullRequest}
							disabled={isCreatingPr || isSyncing}
						>
							{isCreatingPr ? (
								<>
									<Loader2 className="size-3.5 animate-spin" />
									Creating PR...
								</>
							) : (
								<>Create PR</>
							)}
						</Button>
					</div>
				</div>
			) : (
				<>
					<div className="space-y-1.5">
						<Label htmlFor="repository-name">Repository name</Label>
						<Input
							id="repository-name"
							value={repositoryName}
							onChange={(event) => setRepositoryName(event.target.value)}
							placeholder="my-app"
							className="h-8 text-xs"
							disabled={isPublishing}
						/>
					</div>
					<div className="space-y-1.5">
						<Label>Repository visibility</Label>
						<Select
							value={visibility}
							onValueChange={(value) => setVisibility(value as Visibility)}
							disabled={isPublishing}
						>
							<SelectTrigger
								id="repository-visibility"
								className="w-full h-8 text-xs cursor-pointer"
							>
								<SelectValue placeholder="Select visibility" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="private" className="cursor-pointer">
									Private
								</SelectItem>
								<SelectItem value="public" className="cursor-pointer">
									Public
								</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2 pt-1">
						{publishedUrl ? (
							<Button
								variant="ghost"
								size="sm"
								className="h-8 w-full px-2 text-xs gap-1 cursor-pointer"
								onClick={() => {
									selection();
									window.open(publishedUrl, "_blank", "noreferrer");
								}}
							>
								<Icons.gitHub className="size-3.5" />
								Open repo
							</Button>
						) : (
							<div />
						)}
						<Button
							size="sm"
							className="h-8 w-full px-3 text-xs gap-1 cursor-pointer"
							onClick={publishToGitHub}
							disabled={isPublishing}
						>
							{isPublishing ? (
								<>
									<Loader2 className="size-3.5 animate-spin" />
									Committing...
								</>
							) : (
								<>Commit</>
							)}
						</Button>
					</div>
				</>
			)}
		</div>
	);

	const trigger = isMobile ? (
		<Button
			variant="outline"
			size="icon"
			className="size-9 cursor-pointer"
			aria-label="Commit"
			title="Commit"
		>
			<GitBranch className="size-4" />
		</Button>
	) : (
		<Button variant="outline" className="h-8 px-2 gap-1.5 cursor-pointer">
			<UploadCloud className="size-3.5 mr-2" />
			<span>Commit</span>
		</Button>
	);

	if (isMobile) {
		return (
			<Drawer open={open} onOpenChange={setOpen}>
				<DrawerTrigger asChild>{trigger}</DrawerTrigger>
				<DrawerContent className="max-h-[85vh]">
					<DrawerHeader>
						<DrawerTitle>{headerTitle}</DrawerTitle>
						<DrawerDescription>{headerDescription}</DrawerDescription>
					</DrawerHeader>
					<div className="overflow-y-auto p-4 pt-0">{panelBody}</div>
				</DrawerContent>
			</Drawer>
		);
	}

	return (
		<Popover
			open={open}
			onOpenChange={(nextOpen) => {
				if (nextOpen) {
					selection();
				}
				setOpen(nextOpen);
			}}
		>
			<PopoverTrigger asChild>{trigger}</PopoverTrigger>
			<PopoverContent align="end" className="w-80">
				<div className="space-y-3">
					<div className="space-y-1">
						<div className="text-sm font-medium">{headerTitle}</div>
						<p className="text-xs text-muted-foreground">{headerDescription}</p>
					</div>
					{panelBody}
				</div>
			</PopoverContent>
		</Popover>
	);
}
