"use client";

import {
	ArrowLeft,
	ChevronDown,
	Eye,
	EyeOff,
	Pencil,
	Plus,
	Server,
	X,
} from "lucide-react";
import {
	startTransition,
	useActionState,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { useConnectors } from "@/components/connectors-provider";
import { Icons } from "@/components/icons/icons";
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
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	createConnector,
	deleteConnector,
	toggleConnectorStatus,
	updateConnector,
} from "@/lib/actions/connectors";
import type { Connector } from "@/lib/db/schema";

interface ConnectorDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

type FormState = {
	success: boolean;
	message: string;
	errors: Record<string, string>;
};

const initialState: FormState = {
	success: false,
	message: "",
	errors: {},
};

type View = "list" | "presets" | "form";

interface PresetConfig {
	name: string;
	type: "local" | "remote";
	command?: string;
	url?: string;
	envKeys?: string[];
}

const PRESETS: PresetConfig[] = [
	{
		name: "Browserbase",
		type: "local",
		command: "npx @browserbasehq/mcp",
		envKeys: ["BROWSERBASE_API_KEY", "BROWSERBASE_PROJECT_ID"],
	},
	{
		name: "Context7",
		type: "remote",
		url: "https://mcp.context7.com/mcp",
	},
	{
		name: "Convex",
		type: "local",
		command: "npx -y convex@latest mcp start",
	},
	{
		name: "Figma",
		type: "remote",
		url: "https://mcp.figma.com/mcp",
	},
	{
		name: "Hugging Face",
		type: "remote",
		url: "https://hf.co/mcp",
	},
	{
		name: "Linear",
		type: "remote",
		url: "https://mcp.linear.app/sse",
	},
	{
		name: "Notion",
		type: "remote",
		url: "https://mcp.notion.com/mcp",
	},
	{
		name: "Playwright",
		type: "local",
		command: "npx -y @playwright/mcp@latest",
	},
	{
		name: "Supabase",
		type: "remote",
		url: "https://mcp.supabase.com/mcp",
	},
];

type PresetIconKey =
	| "browserbase"
	| "context7"
	| "convex"
	| "figma"
	| "huggingFace"
	| "linear"
	| "notion"
	| "playwright"
	| "supabase";

const getPresetIcon = (presetName: string): PresetIconKey | undefined => {
	const iconMap: Record<string, PresetIconKey> = {
		Browserbase: "browserbase",
		Context7: "context7",
		Convex: "convex",
		Figma: "figma",
		"Hugging Face": "huggingFace",
		Linear: "linear",
		Notion: "notion",
		Playwright: "playwright",
		Supabase: "supabase",
	};
	return iconMap[presetName];
};

interface EnvVar {
	id: string;
	key: string;
	value: string;
}

export function ConnectorDialog({ open, onOpenChange }: ConnectorDialogProps) {
	const formId = useId();
	const nameInputId = `${formId}-name`;
	const baseUrlInputId = `${formId}-base-url`;
	const commandInputId = `${formId}-command`;
	const oauthClientIdInputId = `${formId}-oauth-client-id`;
	const oauthClientSecretInputId = `${formId}-oauth-client-secret`;
	const {
		connectors,
		refreshConnectors,
		isLoading: connectorsLoading,
	} = useConnectors();
	const [view, setView] = useState<View>("list");
	const [editingConnector, setEditingConnector] = useState<Connector | null>(
		null,
	);
	const [serverType, setServerType] = useState<"local" | "remote">("remote");
	const [selectedPreset, setSelectedPreset] = useState<PresetConfig | null>(
		null,
	);
	const [envVars, setEnvVars] = useState<EnvVar[]>([]);
	const [visibleEnvVars, setVisibleEnvVars] = useState<Set<number>>(new Set());
	const [loadingConnectors, setLoadingConnectors] = useState<Set<string>>(
		new Set(),
	);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const createEnvVar = useCallback(
		(key = "", value = ""): EnvVar => ({
			id: crypto.randomUUID(),
			key,
			value,
		}),
		[],
	);

	const [createState, createAction, createPending] = useActionState(
		createConnector,
		initialState,
	);
	const [updateState, updateAction, updatePending] = useActionState(
		updateConnector,
		initialState,
	);

	const isEditing = !!editingConnector;
	const state = isEditing ? updateState : createState;
	const formAction = isEditing ? updateAction : createAction;
	const pending = isEditing ? updatePending : createPending;

	const lastStateRef = useRef<{ success: boolean; message: string }>({
		success: false,
		message: "",
	});

	useEffect(() => {
		if (open) {
			setView("list");
			setEditingConnector(null);
			setSelectedPreset(null);
			setServerType("remote");
			setEnvVars([]);
			setVisibleEnvVars(new Set());
		}
	}, [open]);

	useEffect(() => {
		const stateChanged =
			state.success !== lastStateRef.current.success ||
			state.message !== lastStateRef.current.message;

		if (stateChanged && state.message) {
			if (state.success) {
				toast.success(state.message);
				refreshConnectors();
				setView("list");
				setEditingConnector(null);
				setSelectedPreset(null);
			} else {
				toast.error(state.message);
			}

			lastStateRef.current = { success: state.success, message: state.message };
		}
	}, [state.success, state.message, refreshConnectors]);

	const handleToggleConnectorStatus = async (
		id: string,
		currentStatus: "connected" | "disconnected",
	) => {
		const newStatus =
			currentStatus === "connected" ? "disconnected" : "connected";

		setLoadingConnectors((prev) => new Set(prev).add(id));

		try {
			const result = await toggleConnectorStatus(id, newStatus);

			if (result.success) {
				await refreshConnectors();
				toast.success(result.message);
			} else {
				toast.error(result.message);
			}
		} catch {
			toast.error("Failed to update connector status");
		} finally {
			setLoadingConnectors((prev) => {
				const newSet = new Set(prev);
				newSet.delete(id);
				return newSet;
			});
		}
	};

	const handleDelete = async () => {
		if (!editingConnector) return;

		setIsDeleting(true);
		try {
			const result = await deleteConnector(editingConnector.id);
			if (result.success) {
				toast.success(result.message);
				refreshConnectors();
				setView("list");
				setEditingConnector(null);
			} else {
				toast.error(result.message);
			}
		} catch {
			toast.error("Failed to delete MCP server");
		} finally {
			setIsDeleting(false);
			setShowDeleteDialog(false);
		}
	};

	const startAdding = () => {
		setView("presets");
		setEditingConnector(null);
		setSelectedPreset(null);
		setServerType("remote");
		setEnvVars([]);
	};

	const selectPreset = (preset: PresetConfig) => {
		setSelectedPreset(preset);
		setServerType(preset.type);
		setView("form");
		setEnvVars(preset.envKeys?.map((key) => createEnvVar(key, "")) || []);
	};

	const addCustomServer = () => {
		setSelectedPreset(null);
		setView("form");
	};

	const goBack = () => {
		if (view === "form") {
			if (selectedPreset) {
				setView("presets");
			} else {
				setView("list");
			}
		} else if (view === "presets") {
			setView("list");
		}
	};

	const addEnvVar = () => {
		setEnvVars([...envVars, createEnvVar("", "")]);
	};

	const removeEnvVar = (index: number) => {
		setEnvVars(envVars.filter((_, i) => i !== index));
		const newVisible = new Set<number>();
		visibleEnvVars.forEach((i) => {
			if (i < index) {
				newVisible.add(i);
			} else if (i > index) {
				newVisible.add(i - 1);
			}
		});
		setVisibleEnvVars(newVisible);
	};

	const updateEnvVar = (
		index: number,
		field: "key" | "value",
		value: string,
	) => {
		const newEnvVars = [...envVars];
		newEnvVars[index][field] = value;
		setEnvVars(newEnvVars);
	};

	const toggleEnvVarVisibility = (index: number) => {
		const newVisible = new Set(visibleEnvVars);
		if (newVisible.has(index)) {
			newVisible.delete(index);
		} else {
			newVisible.add(index);
		}
		setVisibleEnvVars(newVisible);
	};

	useEffect(() => {
		if (editingConnector) {
			setServerType(editingConnector.type);
			setEnvVars(
				editingConnector.env
					? Object.entries(editingConnector.env).map(([key, value]) =>
							createEnvVar(key, value),
						)
					: [],
			);
		}
	}, [editingConnector, createEnvVar]);

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle className="flex items-center">
							{(view === "form" || view === "presets") && (
								<Button
									variant="ghost"
									size="sm"
									onClick={goBack}
									className="mr-2 -ml-2 cursor-pointer"
								>
									<ArrowLeft className="h-4 w-4" />
								</Button>
							)}
							{view === "list" && "MCP servers"}
							{view === "presets" && "Add MCP"}
							{view === "form" && (isEditing ? "Edit MCP" : "Add MCP")}
						</DialogTitle>
						<DialogDescription>
							{view === "list" && "Manage your Model Context Protocol servers."}
							{view === "presets" && "Choose a preset or add a custom server."}
							{view === "form" &&
								"Allow agents to reference other apps and services for more context."}
						</DialogDescription>
					</DialogHeader>

					<div className="max-h-[70vh] overflow-y-auto pr-1">
						{view === "list" ? (
							<div className="space-y-3">
								{connectorsLoading ? (
									<div className="text-center text-muted-foreground py-8">
										Loading connectors...
									</div>
								) : connectors.length === 0 ? (
									<div className="text-sm text-center text-muted-foreground py-8">
										No MCP servers configured yet.
									</div>
								) : (
									connectors.map((connector) => {
										const iconKey = getPresetIcon(connector.name);
										const IconComponent = iconKey
											? (Icons[iconKey] as typeof Server)
											: Server;
										return (
											<div
												key={connector.id}
												className="flex items-center justify-between p-3 border rounded-lg"
											>
												<div className="flex items-center space-x-3 flex-1 min-w-0">
													<IconComponent className="h-8 w-8 text-muted-foreground shrink-0" />
													<div className="flex-1 min-w-0">
														<h4 className="font-semibold text-sm">
															{connector.name}
														</h4>
														{connector.description && (
															<p className="text-xs text-muted-foreground truncate">
																{connector.description}
															</p>
														)}
													</div>
												</div>
												<div className="flex items-center gap-2">
													<Button
														type="button"
														variant="ghost"
														size="icon"
														className="h-8 w-8 cursor-pointer"
														onClick={() => {
															setEditingConnector(connector);
															setView("form");
														}}
													>
														<Pencil className="h-4 w-4 text-muted-foreground" />
													</Button>
													<Button
														type="button"
														variant={
															connector.status === "connected"
																? "default"
																: "outline"
														}
														size="sm"
														className="cursor-pointer"
														disabled={loadingConnectors.has(connector.id)}
														onClick={() =>
															handleToggleConnectorStatus(
																connector.id,
																connector.status,
															)
														}
													>
														{connector.status === "connected"
															? "Connected"
															: "Disconnected"}
													</Button>
												</div>
											</div>
										);
									})
								)}
								<div className="flex justify-end pt-2">
									<Button
										type="button"
										variant="default"
										className="cursor-pointer"
										onClick={startAdding}
									>
										Add MCP
									</Button>
								</div>
							</div>
						) : view === "presets" ? (
							<div className="space-y-4">
								<div className="grid grid-cols-3 gap-4">
									{PRESETS.map((preset) => {
										const iconKey = getPresetIcon(preset.name);
										const IconComponent = iconKey
											? (Icons[iconKey] as typeof Server)
											: Server;
										return (
											<button
												key={preset.name}
												className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-accent transition-colors cursor-pointer border"
												onClick={() => selectPreset(preset)}
												type="button"
											>
												<IconComponent className="h-12 w-12 text-muted-foreground" />
												<span className="text-sm font-medium text-center">
													{preset.name}
												</span>
											</button>
										);
									})}
								</div>
								<Button
									variant="outline"
									className="w-full cursor-pointer"
									onClick={addCustomServer}
								>
									Add custom MCP server
								</Button>
							</div>
						) : (
							<div className="space-y-4">
								<form
									noValidate
									onSubmit={(e) => {
										// Build FormData on client side before submission
										const form = e.currentTarget;
										const submitFormData = new FormData(form);

										// Add any missing fields
										if (editingConnector) {
											submitFormData.append("id", editingConnector.id);
										}
										submitFormData.append("type", serverType);

										// Ensure name is included
										if (!submitFormData.has("name")) {
											const nameInput =
												form.querySelector<HTMLInputElement>(
													'input[name="name"]',
												);
											if (nameInput) {
												submitFormData.append("name", nameInput.value);
											}
										}

										// Add preset values if needed
										if (selectedPreset) {
											if (
												selectedPreset.type === "local" &&
												selectedPreset.command
											) {
												submitFormData.set("command", selectedPreset.command);
											} else if (
												selectedPreset.type === "remote" &&
												selectedPreset.url
											) {
												submitFormData.set("baseUrl", selectedPreset.url);
											}
										}

										// Add env vars
										const envObj = envVars.reduce(
											(acc, { key, value }) => {
												if (key && value) acc[key] = value;
												return acc;
											},
											{} as Record<string, string>,
										);
										if (Object.keys(envObj).length > 0) {
											submitFormData.append("env", JSON.stringify(envObj));
										}

										// Prevent default form submission and use React Server Action
										e.preventDefault();
										startTransition(() => {
											formAction(submitFormData);
										});
									}}
									className="space-y-4"
								>
									{selectedPreset &&
										(() => {
											const iconKey = getPresetIcon(selectedPreset.name);
											const IconComponent = iconKey
												? (Icons[iconKey] as typeof Server)
												: Server;
											return (
												<div className="flex items-center gap-2 p-2 bg-muted rounded-md">
													<IconComponent className="h-8 w-8 text-muted-foreground" />
													<div className="flex-1">
														<p className="text-sm font-medium">
															Configuring {selectedPreset.name}
														</p>
													</div>
													<Button
														type="button"
														variant="ghost"
														size="sm"
														className="cursor-pointer"
														onClick={() => setSelectedPreset(null)}
													>
														<X className="h-4 w-4" />
													</Button>
												</div>
											);
										})()}

									<div className="space-y-2">
										<Label htmlFor={nameInputId}>Name</Label>
										<Input
											id={nameInputId}
											name="name"
											placeholder="Example MCP server"
											defaultValue={
												editingConnector?.name || selectedPreset?.name || ""
											}
											required
										/>
										{state.errors?.name && (
											<p className="text-sm text-destructive">
												{state.errors.name}
											</p>
										)}
									</div>

									{!selectedPreset && !isEditing && (
										<div className="space-y-2">
											<Label>Server type</Label>
											<RadioGroup
												value={serverType}
												onValueChange={(value) =>
													setServerType(value as "local" | "remote")
												}
												className="flex gap-4"
											>
												<Label
													htmlFor={`${formId}-server-type-remote`}
													className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer"
												>
													<RadioGroupItem
														value="remote"
														id={`${formId}-server-type-remote`}
													/>
													<span>Remote (HTTP/SSE)</span>
												</Label>
												<Label
													htmlFor={`${formId}-server-type-local`}
													className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer"
												>
													<RadioGroupItem
														value="local"
														id={`${formId}-server-type-local`}
													/>
													<span>Local (STDIO)</span>
												</Label>
											</RadioGroup>
										</div>
									)}

									{serverType === "remote" ? (
										<div className="space-y-2">
											<Label htmlFor={baseUrlInputId}>Base URL</Label>
											<Input
												id={baseUrlInputId}
												name="baseUrl"
												type="url"
												placeholder="https://api.example.com"
												defaultValue={
													editingConnector?.baseUrl || selectedPreset?.url || ""
												}
												required={serverType === "remote"}
												readOnly={!!selectedPreset}
												tabIndex={selectedPreset ? -1 : 0}
											/>
											{selectedPreset && (
												<input
													type="hidden"
													name="baseUrl"
													value={selectedPreset.url || ""}
												/>
											)}
											{state.errors?.baseUrl && (
												<p className="text-sm text-destructive">
													{state.errors.baseUrl}
												</p>
											)}
										</div>
									) : (
										<div className="space-y-2">
											<Label htmlFor={commandInputId}>Command</Label>
											<Input
												id={commandInputId}
												name="command"
												placeholder="npx @browserbasehq/mcp"
												defaultValue={
													editingConnector?.command ||
													selectedPreset?.command ||
													""
												}
												required={serverType === "local"}
												readOnly={!!selectedPreset}
												tabIndex={selectedPreset ? -1 : 0}
											/>
											{selectedPreset && (
												<input
													type="hidden"
													name="command"
													value={selectedPreset.command || ""}
												/>
											)}
											<p className="text-xs text-muted-foreground">
												Full command including all arguments
											</p>
											{state.errors?.command && (
												<p className="text-sm text-destructive">
													{state.errors.command}
												</p>
											)}
										</div>
									)}

									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<Label>
												Environment variables
												{selectedPreset?.envKeys &&
												selectedPreset.envKeys.length > 0
													? ""
													: " (optional)"}
											</Label>
											<Button
												type="button"
												size="sm"
												variant="outline"
												className="cursor-pointer"
												onClick={addEnvVar}
											>
												<Plus className="h-4 w-4 mr-1" />
												Add variable
											</Button>
										</div>
										{envVars.length > 0 && (
											<div className="space-y-2">
												{envVars.map((envVar, index) => (
													<div key={envVar.id} className="flex gap-2">
														<Input
															placeholder="KEY"
															value={envVar.key}
															onChange={(e) =>
																updateEnvVar(index, "key", e.target.value)
															}
															disabled={selectedPreset?.envKeys?.includes(
																envVar.key,
															)}
															className="flex-1"
														/>
														<div className="relative flex-1">
															<Input
																placeholder="value"
																type={
																	visibleEnvVars.has(index)
																		? "text"
																		: "password"
																}
																value={envVar.value}
																onChange={(e) =>
																	updateEnvVar(index, "value", e.target.value)
																}
																className="pr-10"
															/>
															<Button
																type="button"
																variant="ghost"
																size="icon"
																className="absolute right-0 top-0 h-full cursor-pointer hover:bg-transparent"
																onClick={() => toggleEnvVarVisibility(index)}
															>
																{visibleEnvVars.has(index) ? (
																	<EyeOff className="h-4 w-4 text-muted-foreground" />
																) : (
																	<Eye className="h-4 w-4 text-muted-foreground" />
																)}
															</Button>
														</div>
														{!selectedPreset?.envKeys?.includes(envVar.key) && (
															<Button
																type="button"
																variant="ghost"
																size="icon"
																className="cursor-pointer"
																onClick={() => removeEnvVar(index)}
															>
																<X className="h-4 w-4" />
															</Button>
														)}
													</div>
												))}
											</div>
										)}
									</div>

									{serverType === "remote" && (
										<Collapsible>
											<CollapsibleTrigger asChild>
												<Button
													type="button"
													variant="ghost"
													className="w-full justify-between cursor-pointer"
												>
													Advanced settings
													<ChevronDown className="h-4 w-4" />
												</Button>
											</CollapsibleTrigger>
											<CollapsibleContent className="space-y-4 pt-2">
												<div className="space-y-2">
													<Label htmlFor={oauthClientIdInputId}>
														OAuth Client ID (optional)
													</Label>
													<Input
														id={oauthClientIdInputId}
														name="oauthClientId"
														placeholder="OAuth Client ID (optional)"
														defaultValue={editingConnector?.oauthClientId || ""}
													/>
												</div>

												<div className="space-y-2">
													<Label htmlFor={oauthClientSecretInputId}>
														OAuth Client Secret (optional)
													</Label>
													<Input
														id={oauthClientSecretInputId}
														name="oauthClientSecret"
														type="password"
														placeholder="OAuth Client Secret (optional)"
														defaultValue={
															editingConnector?.oauthClientSecret || ""
														}
													/>
												</div>
											</CollapsibleContent>
										</Collapsible>
									)}

									<div className="flex justify-between items-center pt-4">
										{isEditing && (
											<Button
												type="button"
												variant="destructive"
												className="cursor-pointer"
												onClick={(e) => {
													e.preventDefault();
													setShowDeleteDialog(true);
												}}
												disabled={pending || isDeleting}
											>
												Delete
											</Button>
										)}
										<div
											className={`flex space-x-2 ${isEditing ? "ml-auto" : "w-full justify-end"}`}
										>
											<Button
												type="submit"
												className="cursor-pointer"
												disabled={pending || isDeleting}
											>
												{pending
													? isEditing
														? "Saving..."
														: "Creating..."
													: isEditing
														? "Save changes"
														: "Add MCP"}
											</Button>
										</div>
									</div>
								</form>
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>

			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete &quot;{editingConnector?.name}
							&quot;? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="cursor-pointer" disabled={isDeleting}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							disabled={isDeleting}
							className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{isDeleting ? "Deleting..." : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
