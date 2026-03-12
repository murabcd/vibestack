"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { type LinkSafetyModalProps, Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

export const MarkdownRenderer = memo(function MarkdownRenderer({
	content,
	isAnimating = false,
}: {
	content: string;
	isAnimating?: boolean;
}) {
	const linkSafety = useMemo(
		() => ({
			enabled: true,
			renderModal: (props: LinkSafetyModalProps) => (
				<LinkSafetyDialog {...props} />
			),
		}),
		[],
	);

	return (
		<Streamdown
			controls={false}
			isAnimating={isAnimating}
			className="streamdown-content"
			linkSafety={linkSafety}
		>
			{content}
		</Streamdown>
	);
});

function LinkSafetyDialog({
	url,
	isOpen,
	onClose,
	onConfirm,
}: LinkSafetyModalProps) {
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!isOpen) {
			setCopied(false);
		}
	}, [isOpen]);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
		} catch (error) {
			console.error("Failed to copy external link:", error);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-md" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<ExternalLink className="size-5" />
						Open external link?
					</DialogTitle>
					<DialogDescription>
						You&apos;re about to visit an external website.
					</DialogDescription>
				</DialogHeader>
				<div className="max-h-32 overflow-y-auto break-all rounded-md bg-muted p-3 font-mono text-sm">
					{url}
				</div>
				<DialogFooter className="sm:justify-stretch">
					<Button
						type="button"
						variant="outline"
						className="flex-1"
						onClick={() => void handleCopy()}
					>
						{copied ? (
							<>
								<Check className="size-4" />
								Copied
							</>
						) : (
							<>
								<Copy className="size-4" />
								Copy link
							</>
						)}
					</Button>
					<Button type="button" className="flex-1" onClick={onConfirm}>
						<ExternalLink className="size-4" />
						Open link
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
