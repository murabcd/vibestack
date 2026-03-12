"use client";

import { ChevronDown, Eye, EyeOff, Plus, X } from "lucide-react";
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
import { ConnectorBrandIcon } from "@/components/connectors/connector-icon";
import { useConnectors } from "@/components/connectors-provider";
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
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppHaptics } from "@/hooks/use-app-haptics";
import { useIsMobile } from "@/hooks/use-mobile";
import {
	createConnector,
	deleteConnector,
	updateConnector,
} from "@/lib/actions/connectors";
import type { Connector } from "@/lib/db/schema";

interface ConnectorDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialView?: "presets";
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

type View = "presets" | "form";

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

interface EnvVar {
	id: string;
	key: string;
	value: string;
}

export function ConnectorDialog({
	open,
	onOpenChange,
	initialView = "presets",
}: ConnectorDialogProps) {
	const isMobile = useIsMobile();
	const formId = useId();
	const nameInputId = `${formId}-name`;
	const baseUrlInputId = `${formId}-base-url`;
	const commandInputId = `${formId}-command`;
	const oauthClientIdInputId = `${formId}-oauth-client-id`;
	const oauthClientSecretInputId = `${formId}-oauth-client-secret`;
	const { connectors, refreshConnectors } = useConnectors();
	const [view, setView] = useState<View>("presets");
	const [editingConnector, setEditingConnector] = useState<Connector | null>(
		null,
	);
	const [serverType, setServerType] = useState<"local" | "remote">("remote");
	const [selectedPreset, setSelectedPreset] = useState<PresetConfig | null>(
		null,
	);
	const [presetSearchQuery, setPresetSearchQuery] = useState("");
	const [envVars, setEnvVars] = useState<EnvVar[]>([]);
	const [visibleEnvVars, setVisibleEnvVars] = useState<Set<number>>(new Set());
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const {
		selection,
		success: successHaptic,
		error: errorHaptic,
	} = useAppHaptics();

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
			setView(initialView);
			setEditingConnector(null);
			setSelectedPreset(null);
			setPresetSearchQuery("");
			setServerType("remote");
			setEnvVars([]);
			setVisibleEnvVars(new Set());
		}
	}, [open, initialView]);

	useEffect(() => {
		const stateChanged =
			state.success !== lastStateRef.current.success ||
			state.message !== lastStateRef.current.message;

		if (stateChanged && state.message) {
			if (state.success) {
				toast.success(state.message);
				successHaptic();
				refreshConnectors();
				setView("presets");
				setEditingConnector(null);
				setSelectedPreset(null);
			} else {
				toast.error(state.message);
				errorHaptic();
			}

			lastStateRef.current = { success: state.success, message: state.message };
		}
	}, [
		state.success,
		state.message,
		refreshConnectors,
		successHaptic,
		errorHaptic,
	]);

	const handleDelete = async () => {
		if (!editingConnector) return;

		selection();
		setIsDeleting(true);
		try {
			const result = await deleteConnector(editingConnector.id);
			if (result.success) {
				toast.success(result.message);
				successHaptic();
				refreshConnectors();
				setView("presets");
				setEditingConnector(null);
			} else {
				toast.error(result.message);
				errorHaptic();
			}
		} catch {
			toast.error("Failed to delete MCP server");
			errorHaptic();
		} finally {
			setIsDeleting(false);
			setShowDeleteDialog(false);
		}
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

	const cancelForm = () => {
		if (isEditing) {
			setEditingConnector(null);
			setSelectedPreset(null);
			setPresetSearchQuery("");
			setView("presets");
			return;
		}

		if (selectedPreset) {
			setSelectedPreset(null);
			setView("presets");
			return;
		}

		setPresetSearchQuery("");
		setView("presets");
	};

	const normalizedPresetQuery = presetSearchQuery.trim().toLowerCase();
	const filteredPresets = PRESETS.filter((preset) => {
		if (normalizedPresetQuery.length === 0) return true;
		const detail =
			preset.type === "remote"
				? preset.url || "Remote MCP server"
				: preset.command || "Local MCP command";
		return `${preset.name} ${detail}`
			.toLowerCase()
			.includes(normalizedPresetQuery);
	});

	const findExistingConnectorForPreset = (preset: PresetConfig) =>
		connectors.find((connector) => {
			const sameName =
				connector.name.trim().toLowerCase() ===
				preset.name.trim().toLowerCase();
			const sameRemote =
				preset.type === "remote" &&
				!!preset.url &&
				connector.type === "remote" &&
				connector.baseUrl === preset.url;
			const sameLocal =
				preset.type === "local" &&
				!!preset.command &&
				connector.type === "local" &&
				connector.command === preset.command;
			return sameName || sameRemote || sameLocal;
		});

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

	const Root = isMobile ? Drawer : Dialog;
	const Content = isMobile ? DrawerContent : DialogContent;
	const Header = isMobile ? DrawerHeader : DialogHeader;
	const Title = isMobile ? DrawerTitle : DialogTitle;
	const Description = isMobile ? DrawerDescription : DialogDescription;

	return (
		<>
			<Root open={open} onOpenChange={onOpenChange}>
				<Content
					className={
						isMobile ? "max-h-[85vh]" : "sm:max-w-lg p-0 overflow-hidden"
					}
				>
					<div className={isMobile ? undefined : "p-6 pb-3"}>
						<Header className={isMobile ? undefined : "sm:text-left"}>
							<Title className="flex items-center">
								{view === "presets" && "Add MCP"}
								{view === "form" && (isEditing ? "Edit MCP" : "Add MCP")}
							</Title>
							<Description>
								{view === "presets" &&
									"Choose a preset or add a custom server."}
								{view === "form" &&
									"Allow agents to reference other apps and services for more context."}
							</Description>
						</Header>
					</div>

					<div
						className={
							isMobile
								? "max-h-[70vh] overflow-y-auto p-4 pt-0"
								: "max-h-[70vh] overflow-y-auto px-6 pb-6"
						}
					>
						{view === "presets" ? (
							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor={`${formId}-preset-search`}>Search</Label>
									<Input
										id={`${formId}-preset-search`}
										value={presetSearchQuery}
										onChange={(event) =>
											setPresetSearchQuery(event.target.value)
										}
										placeholder="Search connections..."
									/>
								</div>
								<div className="rounded-md border overflow-hidden">
									<ScrollArea className="h-[260px]">
										{filteredPresets.length === 0 ? (
											<div className="h-[260px] grid place-items-center px-3 text-sm text-muted-foreground">
												No presets found.
											</div>
										) : (
											<ul>
												{filteredPresets.map((preset) => {
													const existingConnector =
														findExistingConnectorForPreset(preset);
													const detail =
														preset.type === "remote"
															? preset.url || "Remote MCP server"
															: preset.command || "Local MCP command";
													return (
														<li
															key={preset.name}
															className="flex items-center gap-2 px-3 py-2.5 border-b last:border-b-0"
														>
															<div className="min-w-0 w-0 flex flex-1 items-center gap-2 overflow-hidden">
																<ConnectorBrandIcon
																	name={preset.name}
																	baseUrl={preset.url}
																	command={preset.command}
																/>
																<div className="min-w-0 w-0 flex-1">
																	<div
																		className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium"
																		title={preset.name}
																	>
																		{preset.name}
																	</div>
																	<div
																		className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground"
																		title={detail}
																	>
																		{detail}
																	</div>
																</div>
															</div>
															<div className="flex items-center gap-2 shrink-0 ml-2">
																{existingConnector && (
																	<span
																		className={`rounded-md px-2 py-1 text-xs font-medium ${
																			existingConnector.status === "connected"
																				? "bg-primary text-primary-foreground"
																				: "bg-muted text-muted-foreground"
																		}`}
																	>
																		{existingConnector.status === "connected"
																			? "Connected"
																			: "Disconnected"}
																	</span>
																)}
																<Button
																	type="button"
																	variant="outline"
																	size="sm"
																	className="cursor-pointer"
																	onClick={() => {
																		if (existingConnector) {
																			setEditingConnector(existingConnector);
																			setSelectedPreset(null);
																			setView("form");
																			return;
																		}
																		selectPreset(preset);
																	}}
																>
																	{existingConnector ? "Edit" : "Add"}
																</Button>
															</div>
														</li>
													);
												})}
											</ul>
										)}
									</ScrollArea>
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
										selection();
										startTransition(() => {
											formAction(submitFormData);
										});
									}}
									className="space-y-4"
								>
									{selectedPreset &&
										(() => {
											return (
												<div className="flex items-center gap-2 p-2 bg-muted rounded-md">
													<ConnectorBrandIcon
														name={selectedPreset.name}
														baseUrl={selectedPreset.url}
														command={selectedPreset.command}
														className="size-10 rounded-lg bg-background"
														iconClassName="size-5"
													/>
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
													selection();
													setShowDeleteDialog(true);
												}}
												disabled={pending || isDeleting}
											>
												Delete
											</Button>
										)}
										<div
											className={`flex space-x-2 ${isEditing ? "ml-auto" : isMobile ? "w-full" : "w-full justify-end"}`}
										>
											<Button
												type="button"
												variant="ghost"
												className={`cursor-pointer ${!isEditing && isMobile ? "w-full" : ""}`}
												onClick={cancelForm}
												disabled={pending || isDeleting}
											>
												Cancel
											</Button>
											<Button
												type="submit"
												className={`cursor-pointer ${!isEditing && isMobile ? "w-full" : ""}`}
												disabled={pending || isDeleting}
											>
												{pending
													? isEditing
														? "Saving..."
														: "Adding..."
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
				</Content>
			</Root>

			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete this
							MCP server and remove it from your project.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							className="cursor-pointer border-transparent bg-transparent shadow-none hover:bg-accent"
							disabled={isDeleting}
							onClick={selection}
						>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							disabled={isDeleting}
							className="cursor-pointer"
						>
							{isDeleting ? "Continuing..." : "Continue"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
