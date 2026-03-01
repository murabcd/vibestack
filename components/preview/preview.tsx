"use client";

import { ScrollArea } from "@radix-ui/react-scroll-area";
import { CompassIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BarLoader } from "react-spinners";
import { Panel, PanelHeader } from "@/components/panels/panels";
import { PreviewLoading } from "@/components/preview/preview-loading";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
	className?: string;
	disabled?: boolean;
	url?: string;
}

export function Preview({ className, disabled, url }: Props) {
	const [currentUrl, setCurrentUrl] = useState(url);
	const [error, setError] = useState<string | null>(null);
	const [inputValue, setInputValue] = useState(url || "");
	const [isLoading, setIsLoading] = useState(false);
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const loadStartTime = useRef<number | null>(null);

	useEffect(() => {
		setCurrentUrl(url);
		setInputValue(url || "");
	}, [url]);

	const refreshIframe = () => {
		if (iframeRef.current && currentUrl) {
			setIsLoading(true);
			setError(null);
			loadStartTime.current = Date.now();
			iframeRef.current.src = "";
			setTimeout(() => {
				if (iframeRef.current) {
					iframeRef.current.src = currentUrl;
				}
			}, 10);
		}
	};

	const loadNewUrl = () => {
		if (iframeRef.current && inputValue) {
			if (inputValue !== currentUrl) {
				setIsLoading(true);
				setError(null);
				loadStartTime.current = Date.now();
				iframeRef.current.src = inputValue;
			} else {
				refreshIframe();
			}
		}
	};

	const handleIframeLoad = () => {
		setIsLoading(false);
		setError(null);
	};

	const handleIframeError = () => {
		setIsLoading(false);
		setError("Failed to load the page");
	};

	return (
		<Panel className={cn(className, "border-0")}>
			<PanelHeader className="h-10 min-h-10 text-xs px-2 py-0.5">
				<div className="flex w-full items-center gap-2">
					<TooltipProvider delayDuration={120}>
						<div className="inline-flex items-center gap-1">
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										asChild
										variant="ghost"
										size="sm"
										className="h-7 w-7 p-0 rounded-md border border-transparent"
									>
										<a href={currentUrl} target="_blank" rel="noreferrer">
											<CompassIcon className="size-3.5" />
										</a>
									</Button>
								</TooltipTrigger>
								<TooltipContent>Open in new tab</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										onClick={refreshIframe}
										type="button"
										variant="ghost"
										size="sm"
										className={cn(
											"h-7 w-7 p-0 rounded-md border border-transparent",
											{
												"animate-spin": isLoading,
											},
										)}
									>
										<RefreshCwIcon className="size-3.5" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Refresh preview</TooltipContent>
							</Tooltip>
						</div>
					</TooltipProvider>

					<div className="flex-1 flex justify-center">
						{url && (
							<input
								type="text"
								className="text-xs h-7 border border-border/80 px-3 bg-background rounded-md focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring w-full max-w-[640px] min-w-[220px]"
								onChange={(event) => setInputValue(event.target.value)}
								onClick={(event) => event.currentTarget.select()}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										event.currentTarget.blur();
										loadNewUrl();
									}
								}}
								value={inputValue}
							/>
						)}
					</div>
				</div>
			</PanelHeader>

			<div className="flex h-[calc(100%-2rem-1px)] relative">
				{disabled && (
					<div className="absolute inset-0 bg-background flex items-center justify-center p-4">
						<div className="text-center">
							<p className="text-sm text-muted-foreground">
								Sandbox is stopped
							</p>
							<p className="text-xs text-muted-foreground mt-1">
								Start or restart the dev server from the toolbar.
							</p>
						</div>
					</div>
				)}
				{!currentUrl && !disabled && (
					<div className="absolute inset-0 bg-background flex items-center justify-center p-4">
						<PreviewLoading />
					</div>
				)}
				{currentUrl && !disabled && (
					<>
						<ScrollArea className="w-full">
							<iframe
								ref={iframeRef}
								src={currentUrl}
								className="w-full h-full"
								onLoad={handleIframeLoad}
								onError={handleIframeError}
								title="Browser content"
							/>
						</ScrollArea>

						{isLoading && !error && (
							<div className="absolute inset-0 bg-background bg-opacity-90 flex items-center justify-center flex-col gap-2">
								<BarLoader color="var(--color-primary)" />
								<span className="text-muted-foreground text-xs">
									Loading...
								</span>
							</div>
						)}

						{error && (
							<div className="absolute inset-0 bg-background flex items-center justify-center flex-col gap-2">
								<span className="text-destructive text-sm">
									Failed to load page
								</span>
								<button
									className="text-primary hover:underline text-sm"
									type="button"
									onClick={() => {
										if (currentUrl) {
											setIsLoading(true);
											setError(null);
											const newUrl = new URL(currentUrl);
											newUrl.searchParams.set("t", Date.now().toString());
											setCurrentUrl(newUrl.toString());
										}
									}}
								>
									Try again
								</button>
							</div>
						)}
					</>
				)}
			</div>
		</Panel>
	);
}
