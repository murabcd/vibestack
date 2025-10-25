"use client";

import { ScrollArea } from "@radix-ui/react-scroll-area";
import { CompassIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BarLoader } from "react-spinners";
import { Panel, PanelHeader } from "@/components/panels/panels";
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
			<PanelHeader className="text-xs px-2 py-0.5">
				<div className="absolute flex items-center space-x-1">
					<a href={currentUrl} target="_blank" className="cursor-pointer px-1">
						<CompassIcon className="w-3" />
					</a>
					<button
						onClick={refreshIframe}
						type="button"
						className={cn("cursor-pointer px-1", {
							"animate-spin": isLoading,
						})}
					>
						<RefreshCwIcon className="w-3" />
					</button>
				</div>

				<div className="m-auto h-6">
					{url && (
						<input
							type="text"
							className="text-xs h-6 border border-input px-4 bg-background rounded focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent min-w-[300px]"
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
			</PanelHeader>

			<div className="flex h-[calc(100%-2rem-1px)] relative">
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
								<BarLoader color="#666" />
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
