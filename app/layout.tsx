import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ChatProvider } from "@/lib/chat-context";
import { CommandLogsStream } from "@/components/commands-logs/commands-logs-stream";
import { ErrorMonitor } from "@/components/error-monitor/error-monitor";
import { Geist, Geist_Mono } from "next/font/google";
import { SandboxState } from "@/components/modals/sandbox-state";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Suspense } from "react";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

import "./globals.css";

export const metadata: Metadata = {
	metadataBase: new URL("https://vibestack-code.vercel.app"),
	title: "VibeStack",
	description: `This is a end-to-end coding platform where the user can enter text prompts, and the agent will create a full stack application. It uses Vercel's AI Cloud services like Sandbox for secure code execution, Fluid Compute for efficient rendering and streaming, and it's built with Next.js and the AI SDK.`,
	icons: {
		icon: "/logo.svg",
	},
	openGraph: {
		siteName: "VibeStack",
		images: [
			{
				url: "/api/og",
				width: 1200,
				height: 630,
			},
		],
		locale: "en_US",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		images: ["/api/og"],
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	viewportFit: "cover",
};

export default async function RootLayout({
	children,
}: Readonly<{ children: ReactNode }>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					<SidebarProvider defaultOpen={true}>
						<Suspense fallback={null}>
							<NuqsAdapter>
								<ChatProvider>
									<ErrorMonitor>{children}</ErrorMonitor>
								</ChatProvider>
							</NuqsAdapter>
						</Suspense>
					</SidebarProvider>
					<Toaster />
					<CommandLogsStream />
					<SandboxState />
				</ThemeProvider>
			</body>
		</html>
	);
}
