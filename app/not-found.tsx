"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";

export default function NotFound() {
	return (
		<div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
			<Empty>
				<EmptyHeader>
					<EmptyTitle>404 - Not Found</EmptyTitle>
					<EmptyDescription>
						The project you&apos;re looking for doesn&apos;t exist. Go back to
						the home page.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button asChild size="sm">
						<Link href="/">Go Back</Link>
					</Button>
				</EmptyContent>
			</Empty>
		</div>
	);
}
