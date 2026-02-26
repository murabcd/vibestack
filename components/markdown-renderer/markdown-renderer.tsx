import { memo } from "react";
import { Streamdown } from "streamdown";

export const MarkdownRenderer = memo(function MarkdownRenderer({
	content,
	isAnimating = false,
}: {
	content: string;
	isAnimating?: boolean;
}) {
	return (
		<Streamdown
			controls={false}
			isAnimating={isAnimating}
			className="streamdown-content"
		>
			{content}
		</Streamdown>
	);
});
