"use client";

import { Header } from "./header";
import { PromptForm } from "@/components/prompt-form";
import { PromptInputProvider } from "@/components/ui/prompt-input";
import { useLocalStorageValue } from "@/lib/use-local-storage-value";
import type { PromptInputMessage } from "@/components/ui/prompt-input";
import { Suggestions } from "@/components/suggestions";

interface InitialScreenProps {
	onMessageSubmit: (message: PromptInputMessage) => void;
}

export function InitialScreen({ onMessageSubmit }: InitialScreenProps) {
	const [storedInput] = useLocalStorageValue("prompt-input");

	return (
		<div className="flex flex-col h-screen max-h-screen overflow-hidden">
			<Header className="flex items-center w-full" />

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
						<PromptForm onSubmit={onMessageSubmit} className="w-full" />

						{/* Suggestions below the prompt input */}
						<Suggestions />
					</PromptInputProvider>
				</div>
			</div>
		</div>
	);
}
