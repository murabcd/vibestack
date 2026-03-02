"use client";

import { useState } from "react";
import { Icons } from "@/components/icons/icons";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth/client";

export function SignIn() {
	const [showDialog, setShowDialog] = useState(false);
	const [loadingGitHub, setLoadingGitHub] = useState(false);

	const handleGitHubSignIn = async () => {
		setLoadingGitHub(true);
		try {
			await authClient.signIn.social({
				provider: "github",
				callbackURL: window.location.href,
			});
		} finally {
			setLoadingGitHub(false);
		}
	};

	return (
		<>
			<Button
				onClick={() => setShowDialog(true)}
				variant="outline"
				size="sm"
				className="cursor-pointer"
			>
				Sign in
			</Button>

			<Dialog open={showDialog} onOpenChange={setShowDialog}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Sign in</DialogTitle>
						<DialogDescription>
							Sign in with GitHub to continue.
						</DialogDescription>
					</DialogHeader>

					<div className="flex flex-col gap-3 py-4">
						<Button
							onClick={handleGitHubSignIn}
							disabled={loadingGitHub}
							variant="outline"
							size="lg"
							className="w-full cursor-pointer"
						>
							{loadingGitHub ? (
								<>
									<Icons.loadingSpinner />
									Loading...
								</>
							) : (
								<>
									<Icons.gitHub />
									Sign in with GitHub
								</>
							)}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
