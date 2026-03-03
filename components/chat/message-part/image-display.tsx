import type { UIMessage } from "ai";
import { memo } from "react";
import {
	Attachment,
	AttachmentInfo,
	AttachmentPreview,
	Attachments,
} from "@/components/ai-elements/attachments";
import { cn } from "@/lib/utils";

type FilePart = Extract<UIMessage["parts"][number], { type: "file" }>;

interface Props {
	parts: FilePart[];
	messageRole: "user" | "assistant";
}

export const ImageDisplay = memo(function ImageDisplay({
	parts,
	messageRole,
}: Props) {
	if (parts.length === 0) {
		return null;
	}
	const variant = messageRole === "assistant" ? "list" : "grid";

	return (
		<Attachments
			className={cn("my-2", messageRole === "assistant" && "ml-0")}
			variant={variant}
		>
			{parts.map((part, index) => {
				const attachment = {
					...part,
					id: `file:${part.url || part.filename || part.mediaType || "unknown"}:${index}`,
				};
				return (
					<Attachment data={attachment} key={attachment.id}>
						<AttachmentPreview />
						<AttachmentInfo showMediaType={variant === "list"} />
					</Attachment>
				);
			})}
		</Attachments>
	);
});
