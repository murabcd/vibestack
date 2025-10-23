"use client";

import { TEST_PROMPTS } from "@/lib/ai/constants";
import { usePromptInputController } from "@/components/ui/prompt-input";

export function Suggestions() {
	const controller = usePromptInputController();

	return (
		<div className="mt-6">
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
				{TEST_PROMPTS.map((prompt) => (
					<button
						key={prompt}
						type="button"
						className="block w-full px-4 py-3 rounded-lg border border-dashed shadow-sm cursor-pointer border-border hover:bg-secondary/50 hover:text-primary text-left text-sm transition-colors"
						onClick={() => {
							controller.textInput.setInput(prompt);
						}}
					>
						{prompt}
					</button>
				))}
			</div>
		</div>
	);
}
