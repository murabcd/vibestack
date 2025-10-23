import { MonacoSyntaxHighlighter } from "./monaco-syntax-highlighter";
import { FileEditor } from "./file-editor";
import { PulseLoader } from "react-spinners";
import { memo } from "react";
import useSWR from "swr";

interface Props {
	sandboxId: string;
	path: string;
	editable?: boolean;
	onUnsavedChanges?: (hasChanges: boolean) => void;
	onSavingStateChange?: (isSaving: boolean) => void;
	onSaveSuccess?: () => void;
}

export const FileContent = memo(function FileContent({
	sandboxId,
	path,
	editable = false,
	onUnsavedChanges,
	onSavingStateChange,
	onSaveSuccess,
}: Props) {
	const searchParams = new URLSearchParams({ path });
	const content = useSWR(
		`/api/sandboxes/${sandboxId}/files?${searchParams.toString()}`,
		async (pathname: string, init: RequestInit) => {
			const response = await fetch(pathname, init);
			const text = await response.text();
			return text;
		},
		{ refreshInterval: 1000 },
	);

	if (content.isLoading || !content.data) {
		return (
			<div className="absolute w-full h-full flex items-center text-center">
				<div className="flex-1">
					<PulseLoader className="opacity-60" size={8} />
				</div>
			</div>
		);
	}

	return (
		<div className="absolute w-full h-full">
			{editable ? (
				<FileEditor
					filename={path}
					initialContent={content.data}
					sandboxId={sandboxId}
					onUnsavedChanges={onUnsavedChanges}
					onSavingStateChange={onSavingStateChange}
					onSaveSuccess={onSaveSuccess}
				/>
			) : (
				<MonacoSyntaxHighlighter path={path} code={content.data} />
			)}
		</div>
	);
});
