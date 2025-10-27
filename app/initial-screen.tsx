"use client";

import { PromptForm } from "@/components/forms/prompt-form";
import { Suggestions } from "@/components/forms/suggestions";
import type { PromptInputMessage } from "@/components/ui/prompt-input";
import { PromptInputProvider } from "@/components/ui/prompt-input";
import { useLocalStorageValue } from "@/lib/use-local-storage-value";

interface InitialScreenProps {
	onMessageSubmit: (message: PromptInputMessage) => void;
	isLoading?: boolean;
	initialSandboxDuration: number;
	initialModelId?: string;
}

export function InitialScreen({
	onMessageSubmit,
	isLoading,
	initialSandboxDuration,
	initialModelId,
}: InitialScreenProps) {
	const [storedInput] = useLocalStorageValue("prompt-input");

	return (
		<div className="flex flex-col h-screen max-h-screen overflow-hidden">
			<div className="flex-1 flex items-center justify-center px-4 pb-20 md:pb-4">
				<div className="w-full max-w-2xl text-center">
					{/* Title and subtitle */}
					<div className="mb-8">
						<h1 className="text-4xl font-bold mb-4 text-foreground">
							What do you want to create?
						</h1>
						<p className="text-lg text-muted-foreground">
							Start building with a single prompt. No coding needed.
						</p>
					</div>

					{/* Prompt input */}
					<PromptInputProvider initialInput={storedInput || ""}>
						<PromptForm
							onSubmit={onMessageSubmit}
							className="w-full"
							isLoading={isLoading}
							initialSandboxDuration={initialSandboxDuration}
							initialModelId={initialModelId}
						/>

						{/* Suggestions below the prompt input */}
						<Suggestions />
					</PromptInputProvider>
				</div>
			</div>
		</div>
	);
}
