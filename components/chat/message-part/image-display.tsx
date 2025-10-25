import type { UIMessage } from "ai";
import Image from "next/image";
import { memo } from "react";
import { cn } from "@/lib/utils";

interface Props {
	part: UIMessage["parts"][number];
}

export const ImageDisplay = memo(function ImageDisplay({ part }: Props) {
	if (part.type !== "file") {
		return null;
	}

	const isImage = part.mediaType?.startsWith("image/");

	if (!isImage || !part.url) {
		return null;
	}

	return (
		<div className="my-2">
			<Image
				src={part.url}
				alt={part.filename || "Attached image"}
				width={400}
				height={256}
				className={cn(
					"max-w-full h-auto rounded-lg border",
					"max-h-64 object-contain bg-muted/50",
				)}
				style={{ width: "auto", height: "auto" }}
			/>
			{part.filename && (
				<div className="text-xs text-muted-foreground mt-1">
					{part.filename}
				</div>
			)}
		</div>
	);
});
