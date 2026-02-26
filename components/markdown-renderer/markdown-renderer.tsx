import { memo } from "react";
import { Streamdown } from "streamdown";

export const MarkdownRenderer = memo(function MarkdownRenderer({
	content,
}: {
	content: string;
}) {
	return (
		<Streamdown controls={false} className="streamdown-content">
			{content}
		</Streamdown>
	);
});
