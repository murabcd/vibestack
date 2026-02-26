import { Skeleton } from "@/components/ui/skeleton";

const lineWidths = [
	{ key: "line-1", width: "w-[92%]" },
	{ key: "line-2", width: "w-[84%]" },
	{ key: "line-3", width: "w-[76%]" },
	{ key: "line-4", width: "w-[88%]" },
	{ key: "line-5", width: "w-[70%]" },
	{ key: "line-6", width: "w-[86%]" },
	{ key: "line-7", width: "w-[80%]" },
	{ key: "line-8", width: "w-[74%]" },
	{ key: "line-9", width: "w-[90%]" },
	{ key: "line-10", width: "w-[68%]" },
	{ key: "line-11", width: "w-[82%]" },
	{ key: "line-12", width: "w-[78%]" },
];

export function MonacoLoadingSkeleton() {
	return (
		<div className="absolute inset-0 flex gap-3 bg-background p-3">
			<Skeleton className="h-full w-10 rounded-sm bg-muted/60" />
			<div className="flex-1 space-y-2 pt-1">
				{lineWidths.map((line) => (
					<Skeleton
						// Stable pattern; width classes make the placeholder feel code-like.
						key={line.key}
						className={`h-3 rounded-sm ${line.width}`}
					/>
				))}
			</div>
		</div>
	);
}
