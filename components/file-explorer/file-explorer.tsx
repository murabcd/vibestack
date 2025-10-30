"use client";

import {
	ChevronDownIcon,
	ChevronRightIcon,
	EditIcon,
	FileIcon,
	FolderIcon,
	LockIcon,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { buildFileTree, type FileNode } from "./build-file-tree";

interface Props {
	className: string;
	disabled?: boolean;
	paths: string[];
	sandboxId?: string;
}

export const FileExplorer = memo(function FileExplorer({
	className,
	disabled,
	paths,
	sandboxId,
}: Props) {
	const fileTree = useMemo(() => buildFileTree(paths), [paths]);
	const [selected, setSelected] = useState<FileNode | null>(null);
	const [fs, setFs] = useState<FileNode[]>(fileTree);
	const [isEditMode, setIsEditMode] = useState(false);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [showDiff, setShowDiff] = useState(false);

	// File history for diff viewer
	const hasOriginal = useFileHistory((state) => state.hasOriginal);

	// Safety dialog states
	const [showSaveDialog, setShowSaveDialog] = useState(false);
	const [pendingFile, setPendingFile] = useState<FileNode | null>(null);
	const [showCloseDialog, setShowCloseDialog] = useState(false);

	useEffect(() => {
		setFs(fileTree);
	}, [fileTree]);

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
				// Reset edit mode when selecting a new file
				setIsEditMode(false);
				setHasUnsavedChanges(false);
			}
		},
		[hasUnsavedChanges, selected],
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
				setIsEditMode(false);
				setHasUnsavedChanges(false);
			}
			setShowSaveDialog(false);
			setPendingFile(null);
		}, 500);
	}, [pendingFile]);

	const handleSaveDialogDontSave = useCallback(() => {
		if (pendingFile) {
			setSelected(pendingFile);
			setIsEditMode(false);
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
			setIsEditMode(false);
			setHasUnsavedChanges(false);
			setShowCloseDialog(false);
		}, 500);
	}, []);

	const handleCloseDialogDontSave = useCallback(() => {
		setSelected(null);
		setIsEditMode(false);
		setHasUnsavedChanges(false);
		setShowCloseDialog(false);
	}, []);

	const handleCloseDialogCancel = useCallback(() => {
		setShowCloseDialog(false);
	}, []);

	const renderFileTree = useCallback(
		(nodes: FileNode[], depth = 0) => {
			return nodes.map((node) => (
				<FileTreeNode
					key={node.path}
					node={node}
					depth={depth}
					selected={selected}
					sandboxId={sandboxId}
					onToggleFolder={toggleFolder}
					onSelectFile={selectFile}
					renderFileTree={renderFileTree}
				/>
			));
		},
		[selected, toggleFolder, selectFile, sandboxId],
	);

	return (
		<>
			<Panel className={cn(className, "border-0")}>
				<PanelHeader className="text-xs px-2 py-0.5">
					<FileIcon className="size-3 mr-1.5" />
					<span className="font-medium">Files</span>
					{selected && !disabled && (
						<>
							<span className="ml-auto text-muted-foreground text-xs">
								{selected.path}
							</span>
							<div className="ml-2 flex items-center gap-1">
								<Button
									variant={isEditMode ? "ghost" : "default"}
									size="sm"
									onClick={() => setIsEditMode(!isEditMode)}
									className="h-6 px-2 text-xs"
									disabled={isSaving}
								>
									{isEditMode ? (
										<>
											<LockIcon className="size-3" />
											Lock
										</>
									) : (
										<>
											<EditIcon className="size-3" />
											Edit
										</>
									)}
								</Button>
								{selected && sandboxId && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setShowDiff(!showDiff)}
										className="h-6 px-2 text-xs"
										disabled={
											!hasOriginal(sandboxId, selected.path.substring(1))
										}
										title={
											!hasOriginal(sandboxId, selected.path.substring(1))
												? "No original content to compare with"
												: showDiff
													? "Hide file changes"
													: "Show file changes"
										}
									>
										{showDiff ? "Hide Changes" : "Show Changes"}
									</Button>
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
									<Button
										variant="ghost"
										size="sm"
										onClick={() => {
											if (hasUnsavedChanges) {
												setShowCloseDialog(true);
											} else {
												setSelected(null);
												setIsEditMode(false);
												setHasUnsavedChanges(false);
											}
										}}
										className="size-6 p-0 text-xs"
										title="Close file"
									>
										×
									</Button>
								)}
							</div>
						</>
					)}
				</PanelHeader>

				<div className="flex text-sm h-[calc(100%-2rem-1px)]">
					<ScrollArea className="w-1/4 border-r border-border shrink-0">
						<div>{renderFileTree(fs)}</div>
					</ScrollArea>
					{selected && sandboxId && !disabled && (
						<div className="w-3/4 shrink-0 h-full">
							<FileContent
								sandboxId={sandboxId}
								path={selected.path.substring(1)}
								editable={isEditMode}
								showDiff={showDiff}
								onUnsavedChanges={handleUnsavedChanges}
								onSavingStateChange={handleSavingStateChange}
								onSaveSuccess={handleSaveSuccess}
							/>
						</div>
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
	depth,
	selected,
	sandboxId,
	onToggleFolder,
	onSelectFile,
	renderFileTree,
}: {
	node: FileNode;
	depth: number;
	selected: FileNode | null;
	sandboxId?: string;
	onToggleFolder: (path: string) => void;
	onSelectFile: (node: FileNode) => void;
	renderFileTree: (nodes: FileNode[], depth: number) => React.ReactNode;
}) {
	const hasOriginal = useFileHistory((state) => state.hasOriginal);
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
					`flex items-center py-0.5 px-1 hover:bg-accent cursor-pointer text-left w-full`,
					{ "bg-accent": selected?.path === node.path },
				)}
				style={{ paddingLeft: `${depth * 16 + 8}px` }}
				type="button"
				aria-expanded={node.type === "folder" ? node.expanded : undefined}
				onClick={handleClick}
			>
				{node.type === "folder" ? (
					<>
						{node.expanded ? (
							<ChevronDownIcon className="w-4 mr-1" />
						) : (
							<ChevronRightIcon className="w-4 mr-1" />
						)}
						<FolderIcon className="w-4 mr-2" />
					</>
				) : (
					<>
						<div className="w-4 mr-1" />
						<FileIcon className="w-4 mr-2 " />
					</>
				)}
				<span className="">{node.name}</span>
				{node.type === "file" &&
					sandboxId &&
					hasOriginal(sandboxId, node.path.substring(1)) && (
						<span
							className="w-2 h-2 rounded-full bg-blue-500 ml-2 animate-pulse"
							title="File has been modified - click 'Show Changes' to see diff"
						/>
					)}
			</button>

			{node.type === "folder" && node.expanded && node.children && (
				<div>{renderFileTree(node.children, depth + 1)}</div>
			)}
		</div>
	);
});
