"use client";

import {
	ChevronDownIcon,
	ChevronRightIcon,
	FileDiff,
	FileIcon,
	FolderIcon,
	FolderOpenIcon,
	FolderTree,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
	PanelGroup,
	PanelResizeHandle,
	Panel as ResizePanel,
} from "react-resizable-panels";
import useSWR from "swr";
import { useFileHistory } from "@/app/state";
import { FileContent } from "@/components/file-explorer/file-content";
import { Panel, PanelHeader } from "@/components/panels/panels";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { buildFileTree, type FileNode } from "./build-file-tree";

interface Props {
	className: string;
	disabled?: boolean;
	paths: string[];
	sandboxId?: string;
}

interface FileDiffStat {
	additions: number;
	deletions: number;
}

const EMPTY_DIFF_STATS: Record<string, FileDiffStat> = {};

export const FileExplorer = memo(function FileExplorer({
	className,
	disabled,
	paths,
	sandboxId,
}: Props) {
	const { isMobile } = useSidebar();
	const [viewMode, setViewMode] = useState<"files" | "changes">("files");
	const diffStats = useSWR<{ stats: Record<string, FileDiffStat> }>(
		sandboxId && !disabled ? `/api/sandboxes/${sandboxId}/diff-stats` : null,
		async (url: string) => {
			const response = await fetch(url);
			if (!response.ok) return { stats: {} };
			return response.json();
		},
		{
			refreshInterval: 3000,
			dedupingInterval: 2000,
			revalidateOnFocus: false,
		},
	);
	const statsByPath = diffStats.data?.stats ?? EMPTY_DIFF_STATS;
	const visiblePaths = useMemo(() => {
		if (viewMode === "files") return paths;
		return paths.filter((path) => {
			const normalized = path.startsWith("/") ? path.substring(1) : path;
			return Boolean(statsByPath[normalized]);
		});
	}, [paths, statsByPath, viewMode]);
	const fileTree = useMemo(() => buildFileTree(visiblePaths), [visiblePaths]);
	const [selected, setSelected] = useState<FileNode | null>(null);
	const [fs, setFs] = useState<FileNode[]>(fileTree);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [isSelectedFileAvailable, setIsSelectedFileAvailable] = useState(true);
	const [revealRequest, setRevealRequest] = useState<
		| {
				lineNumber: number;
				requestId: number;
		  }
		| undefined
	>();

	// Safety dialog states
	const [showSaveDialog, setShowSaveDialog] = useState(false);
	const [pendingFile, setPendingFile] = useState<FileNode | null>(null);
	const [showCloseDialog, setShowCloseDialog] = useState(false);
	const showFiles = useCallback(() => {
		setViewMode((current) => (current === "files" ? current : "files"));
	}, []);
	const showChanges = useCallback(() => {
		setViewMode((current) => (current === "changes" ? current : "changes"));
	}, []);

	useEffect(() => {
		setFs(fileTree);
	}, [fileTree]);

	useEffect(() => {
		if (!selected) return;
		const selectedPath = selected.path.startsWith("/")
			? selected.path.substring(1)
			: selected.path;
		if (!visiblePaths.includes(selectedPath)) {
			setSelected(null);
		}
	}, [selected, visiblePaths]);

	const toggleFolder = useCallback((path: string) => {
		setFs((prev) => {
			const updateNode = (nodes: FileNode[]): FileNode[] =>
				nodes.map((node) => {
					if (node.path === path && node.type === "folder") {
						return { ...node, expanded: !node.expanded };
					} else if (node.children) {
						return { ...node, children: updateNode(node.children) };
					} else {
						return node;
					}
				});
			return updateNode(prev);
		});
	}, []);

	const selectFile = useCallback(
		(node: FileNode) => {
			if (node.type === "file") {
				// Check if current file has unsaved changes
				if (hasUnsavedChanges && selected) {
					setPendingFile(node);
					setShowSaveDialog(true);
					return;
				}

				setSelected(node);
				setHasUnsavedChanges(false);
				setIsSelectedFileAvailable(true);
				setRevealRequest(undefined);
			}
		},
		[hasUnsavedChanges, selected],
	);

	const findFileNodeByPath = useCallback(
		(nodes: FileNode[], targetPath: string): FileNode | null => {
			for (const node of nodes) {
				if (node.type === "file" && node.path === targetPath) {
					return node;
				}
				if (node.children) {
					const found = findFileNodeByPath(node.children, targetPath);
					if (found) return found;
				}
			}
			return null;
		},
		[],
	);

	const expandPath = useCallback((path: string) => {
		setFs((prev) => {
			const parts = path.split("/").filter(Boolean);
			const folderPaths = parts
				.slice(0, -1)
				.map((_, index) => `/${parts.slice(0, index + 1).join("/")}`);
			const folderPathSet = new Set(folderPaths);

			const expandNodes = (nodes: FileNode[]): FileNode[] =>
				nodes.map((node) => {
					if (node.type === "folder") {
						const shouldExpand = folderPathSet.has(node.path);
						return {
							...node,
							expanded: shouldExpand ? true : node.expanded,
							children: node.children ? expandNodes(node.children) : undefined,
						};
					}
					return node;
				});

			return expandNodes(prev);
		});
	}, []);

	const handleOpenFile = useCallback(
		(filePath: string, lineNumber?: number) => {
			const normalizedPath = filePath.startsWith("/")
				? filePath
				: `/${filePath}`;
			const targetNode =
				findFileNodeByPath(fs, normalizedPath) ||
				findFileNodeByPath(fileTree, normalizedPath);
			if (!targetNode) return;

			expandPath(normalizedPath);
			setSelected(targetNode);
			setIsSelectedFileAvailable(true);
			if (lineNumber) {
				setRevealRequest({
					lineNumber,
					requestId: Date.now(),
				});
			}
		},
		[expandPath, fileTree, findFileNodeByPath, fs],
	);

	const handleUnsavedChanges = useCallback((hasChanges: boolean) => {
		setHasUnsavedChanges(hasChanges);
	}, []);

	const handleSavingStateChange = useCallback((saving: boolean) => {
		setIsSaving(saving);
	}, []);

	const handleSaveSuccess = useCallback(() => {
		setHasUnsavedChanges(false);
		// Optionally refresh the file list or trigger preview update
	}, []);

	// Handle save dialog actions
	const handleSaveDialogSave = useCallback(() => {
		// Trigger save by dispatching Cmd+S event
		const event = new KeyboardEvent("keydown", {
			key: "s",
			metaKey: true,
			bubbles: true,
		});
		document.dispatchEvent(event);

		// Wait a moment for save to complete, then switch files
		setTimeout(() => {
			if (pendingFile) {
				setSelected(pendingFile);
				setHasUnsavedChanges(false);
			}
			setShowSaveDialog(false);
			setPendingFile(null);
		}, 500);
	}, [pendingFile]);

	const handleSaveDialogDontSave = useCallback(() => {
		if (pendingFile) {
			setSelected(pendingFile);
			setHasUnsavedChanges(false);
		}
		setShowSaveDialog(false);
		setPendingFile(null);
	}, [pendingFile]);

	const handleSaveDialogCancel = useCallback(() => {
		setShowSaveDialog(false);
		setPendingFile(null);
	}, []);

	// Handle close dialog actions
	const handleCloseDialogSave = useCallback(() => {
		// Trigger save by dispatching Cmd+S event
		const event = new KeyboardEvent("keydown", {
			key: "s",
			metaKey: true,
			bubbles: true,
		});
		document.dispatchEvent(event);

		// Wait a moment for save to complete, then close
		setTimeout(() => {
			setSelected(null);
			setHasUnsavedChanges(false);
			setShowCloseDialog(false);
		}, 500);
	}, []);

	const handleCloseDialogDontSave = useCallback(() => {
		setSelected(null);
		setHasUnsavedChanges(false);
		setShowCloseDialog(false);
	}, []);

	const handleCloseDialogCancel = useCallback(() => {
		setShowCloseDialog(false);
	}, []);

	const renderFileTree = useCallback(
		(nodes: FileNode[]) => {
			return nodes.map((node) => (
				<FileTreeNode
					key={node.path}
					node={node}
					selected={selected}
					sandboxId={sandboxId}
					statsByPath={statsByPath}
					onToggleFolder={toggleFolder}
					onSelectFile={selectFile}
					renderFileTree={renderFileTree}
				/>
			));
		},
		[selected, toggleFolder, selectFile, sandboxId, statsByPath],
	);
	const treePane = (
		<div className="h-full overflow-auto">
			<div className="py-1">
				{fs.length === 0 && viewMode === "changes" ? (
					<div className="px-3 py-3 text-xs text-muted-foreground">
						No changed files detected.
					</div>
				) : (
					renderFileTree(fs)
				)}
			</div>
		</div>
	);
	const contentPane = (
		<div className="h-full min-h-0">
			{disabled ? (
				<div className="h-full w-full flex items-center justify-center p-4">
					<div className="text-center">
						<p className="text-sm text-muted-foreground">Sandbox is stopped</p>
						<p className="text-xs text-muted-foreground mt-1">
							Start or restart the dev server from the toolbar.
						</p>
					</div>
				</div>
			) : selected && sandboxId ? (
				<FileContent
					sandboxId={sandboxId}
					path={selected.path.substring(1)}
					editable={isSelectedFileAvailable}
					revealRequest={revealRequest}
					onOpenFile={handleOpenFile}
					onUnsavedChanges={handleUnsavedChanges}
					onSavingStateChange={handleSavingStateChange}
					onSaveSuccess={handleSaveSuccess}
					onEditorAvailabilityChange={setIsSelectedFileAvailable}
				/>
			) : (
				<div className="h-full w-full flex items-center justify-center p-4">
					<div className="text-center">
						<p className="text-sm text-muted-foreground">No file selected</p>
						<p className="text-xs text-muted-foreground mt-1">
							Select a file from the tree to view or edit it.
						</p>
					</div>
				</div>
			)}
		</div>
	);

	return (
		<>
			<Panel className={cn(className, "border-0 flex flex-col min-h-0")}>
				<PanelHeader className="h-10 min-h-10 text-xs px-2 py-0.5">
					<TooltipProvider delayDuration={120}>
						<div className="inline-flex items-center gap-1 border border-border/80 rounded-xl p-0.5">
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										onClick={showFiles}
										className={cn(
											"h-7 w-7 p-0 rounded-lg",
											viewMode === "files"
												? "bg-accent/40 text-foreground border border-border/80"
												: "text-muted-foreground hover:text-foreground",
										)}
										aria-label="Show all files"
									>
										<FolderTree className="size-3.5" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Show all files</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										onClick={showChanges}
										className={cn(
											"h-7 w-7 p-0 rounded-lg",
											viewMode === "changes"
												? "bg-accent/40 text-foreground border border-border/80"
												: "text-muted-foreground hover:text-foreground",
										)}
										aria-label="Show changed files"
									>
										<FileDiff className="size-3.5" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Show changed files</TooltipContent>
							</Tooltip>
						</div>
					</TooltipProvider>
					{selected && !disabled && (
						<>
							<span className="ml-auto text-muted-foreground text-xs">
								{selected.path}
							</span>
							<div className="ml-2 flex items-center gap-1">
								{!isSelectedFileAvailable && (
									<span className="text-xs text-muted-foreground">
										Read only
									</span>
								)}
								{hasUnsavedChanges && (
									<span
										className="text-xs text-amber-500 font-bold"
										title="Unsaved changes"
									>
										●
									</span>
								)}
								{isSaving && (
									<span className="text-xs text-blue-500" title="Saving...">
										⟳
									</span>
								)}
								{selected && (
									<TooltipProvider delayDuration={120}>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => {
														if (hasUnsavedChanges) {
															setShowCloseDialog(true);
														} else {
															setSelected(null);
															setHasUnsavedChanges(false);
														}
													}}
													className="size-6 p-0 text-xs"
												>
													×
												</Button>
											</TooltipTrigger>
											<TooltipContent>Close file</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								)}
							</div>
						</>
					)}
				</PanelHeader>

				<div className="text-sm flex-1 min-h-0">
					{isMobile ? (
						<PanelGroup
							direction="vertical"
							className="flex h-full"
							key="mobile"
						>
							<ResizePanel defaultSize={35} minSize={20} maxSize={60}>
								<div className="h-full border-b border-border">{treePane}</div>
							</ResizePanel>
							<PanelResizeHandle className="h-px bg-border hover:bg-accent transition-colors" />
							<ResizePanel defaultSize={65} minSize={40}>
								{contentPane}
							</ResizePanel>
						</PanelGroup>
					) : (
						<PanelGroup
							direction="horizontal"
							className="flex h-full"
							key="desktop"
						>
							<ResizePanel defaultSize={25} minSize={15} maxSize={45}>
								<div className="h-full border-r border-border">{treePane}</div>
							</ResizePanel>
							<PanelResizeHandle className="w-px bg-border hover:bg-accent transition-colors" />
							<ResizePanel defaultSize={75} minSize={55}>
								{contentPane}
							</ResizePanel>
						</PanelGroup>
					)}
				</div>
			</Panel>

			{/* Save Confirmation Dialog */}
			<AlertDialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
						<AlertDialogDescription>
							Do you want to save the changes you made to{" "}
							<strong>{selected?.name}</strong> before switching to{" "}
							<strong>{pendingFile?.name}</strong>?
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={handleSaveDialogCancel}>
							Cancel
						</AlertDialogCancel>
						<Button variant="outline" onClick={handleSaveDialogDontSave}>
							Don't Save
						</Button>
						<AlertDialogAction onClick={handleSaveDialogSave}>
							Save
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Close File Confirmation Dialog */}
			<AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
						<AlertDialogDescription>
							Do you want to save the changes you made to{" "}
							<strong>{selected?.name}</strong> before closing it?
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={handleCloseDialogCancel}>
							Cancel
						</AlertDialogCancel>
						<Button variant="outline" onClick={handleCloseDialogDontSave}>
							Don't Save
						</Button>
						<AlertDialogAction onClick={handleCloseDialogSave}>
							Save
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
});

// Memoized file tree node component
const FileTreeNode = memo(function FileTreeNode({
	node,
	selected,
	sandboxId,
	statsByPath,
	onToggleFolder,
	onSelectFile,
	renderFileTree,
}: {
	node: FileNode;
	selected: FileNode | null;
	sandboxId?: string;
	statsByPath: Record<string, FileDiffStat>;
	onToggleFolder: (path: string) => void;
	onSelectFile: (node: FileNode) => void;
	renderFileTree: (nodes: FileNode[]) => React.ReactNode;
}) {
	const hasDiff = useFileHistory((state) => state.hasDiff);
	const handleClick = useCallback(() => {
		if (node.type === "folder") {
			onToggleFolder(node.path);
		} else {
			onSelectFile(node);
		}
	}, [node, onToggleFolder, onSelectFile]);

	return (
		<div>
			<button
				className={cn(
					"flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-sm w-full text-left",
					selected?.path === node.path ? "bg-card" : "hover:bg-card/50",
				)}
				type="button"
				aria-expanded={node.type === "folder" ? node.expanded : undefined}
				onClick={handleClick}
			>
				{node.type === "folder" ? (
					<>
						<div className="flex items-center gap-1 flex-shrink-0">
							{node.expanded ? (
								<ChevronDownIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
							) : (
								<ChevronRightIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
							)}
							{node.expanded ? (
								<FolderOpenIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
							) : (
								<FolderIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
							)}
						</div>
						<span className="text-xs md:text-sm font-medium truncate">
							{node.name}
						</span>
					</>
				) : (
					<>
						<div className="flex items-center gap-1 flex-shrink-0">
							<div className="w-3.5 h-3.5 md:w-4 md:h-4" />
							<FileIcon className="w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground" />
						</div>
						<span className="text-xs md:text-sm truncate">{node.name}</span>
					</>
				)}
				{node.type === "file" &&
					sandboxId &&
					hasDiff(sandboxId, node.path.substring(1)) && (
						<span
							className="w-2 h-2 rounded-full bg-blue-500 ml-2 animate-pulse"
							title="File has unsaved changes"
						/>
					)}
				{node.type === "file" &&
					(() => {
						const stat = statsByPath[node.path.substring(1)];
						if (!stat) return null;
						return (
							<span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
								+{stat.additions} -{stat.deletions}
							</span>
						);
					})()}
			</button>

			{node.type === "folder" && node.expanded && node.children && (
				<div className="ml-3 md:ml-4">{renderFileTree(node.children)}</div>
			)}
		</div>
	);
});
