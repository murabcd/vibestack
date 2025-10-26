"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Icons } from "@/components/icons/icons";
import { getEnabledAuthProviders } from "@/lib/auth/providers";
import { useState } from "react";

export function SignIn() {
	const [showDialog, setShowDialog] = useState(false);
	const [loadingVercel, setLoadingVercel] = useState(false);
	const [loadingGitHub, setLoadingGitHub] = useState(false);

	// Check which auth providers are enabled
	const { github: hasGitHub, vercel: hasVercel } = getEnabledAuthProviders();

	const handleVercelSignIn = async () => {
		setLoadingVercel(true);
		try {
			const response = await fetch("/api/auth/signin/vercel", {
				method: "POST",
			});
			const data = await response.json();
			if (data.url) {
				window.location.href = data.url;
			}
		} catch (error) {
			console.error("Vercel sign-in error:", error);
		} finally {
			setLoadingVercel(false);
		}
	};

	const handleGitHubSignIn = () => {
		setLoadingGitHub(true);
		window.location.href = "/api/auth/signin/github";
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
							{hasGitHub && hasVercel
								? "Choose how you want to sign in to continue."
								: hasVercel
									? "Sign in with Vercel to continue."
									: "Sign in with GitHub to continue."}
						</DialogDescription>
					</DialogHeader>

					<div className="flex flex-col gap-3 py-4">
						{hasVercel && (
							<Button
								onClick={handleVercelSignIn}
								disabled={loadingVercel || loadingGitHub}
								variant="outline"
								size="lg"
								className="w-full"
							>
								{loadingVercel ? (
									<>
										<Icons.loadingSpinner />
										Loading...
									</>
								) : (
									<>
										<Icons.vercel />
										Sign in with Vercel
									</>
								)}
							</Button>
						)}

						{hasGitHub && (
							<Button
								onClick={handleGitHubSignIn}
								disabled={loadingVercel || loadingGitHub}
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
										<Icons.gitHubLogo />
										Sign in with GitHub
									</>
								)}
							</Button>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
