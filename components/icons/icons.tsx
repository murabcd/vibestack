import type { LucideIcon, LucideProps } from "lucide-react";
import { useId } from "react";

export type Icon = LucideIcon;

export const Icons = {
	gitHub: ({ ...props }: LucideProps) => (
		<svg
			className="size-5 p-0.5"
			viewBox="0 0 15 15"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			{...props}
		>
			<title>GitHub</title>
			<path
				d="M7.49933 0.25C3.49635 0.25 0.25 3.49593 0.25 7.50024C0.25 10.703 2.32715 13.4206 5.2081 14.3797C5.57084 14.446 5.70302 14.2222 5.70302 14.0299C5.70302 13.8576 5.69679 13.4019 5.69323 12.797C3.67661 13.235 3.25112 11.825 3.25112 11.825C2.92132 10.9874 2.44599 10.7644 2.44599 10.7644C1.78773 10.3149 2.49584 10.3238 2.49584 10.3238C3.22353 10.375 3.60629 11.0711 3.60629 11.0711C4.25298 12.1788 5.30335 11.8588 5.71638 11.6732C5.78225 11.205 5.96962 10.8854 6.17658 10.7043C4.56675 10.5209 2.87415 9.89918 2.87415 7.12104C2.87415 6.32925 3.15677 5.68257 3.62053 5.17563C3.54576 4.99226 3.29697 4.25521 3.69174 3.25691C3.69174 3.25691 4.30015 3.06196 5.68522 3.99973C6.26337 3.83906 6.8838 3.75895 7.50022 3.75583C8.1162 3.75895 8.73619 3.83906 9.31523 3.99973C10.6994 3.06196 11.3069 3.25691 11.3069 3.25691C11.7026 4.25521 11.4538 4.99226 11.3795 5.17563C11.8441 5.68257 12.1245 6.32925 12.1245 7.12104C12.1245 9.9063 10.4292 10.5192 8.81452 10.6985C9.07444 10.9224 9.30633 11.3648 9.30633 12.0413C9.30633 13.0102 9.29742 13.7922 9.29742 14.0299C9.29742 14.2239 9.42828 14.4496 9.79591 14.3788C12.6746 13.4179 14.75 10.7025 14.75 7.50024C14.75 3.49593 11.5036 0.25 7.49933 0.25Z"
				fill="currentColor"
				fillRule="evenodd"
				clipRule="evenodd"
			/>
		</svg>
	),
	google: ({ ...props }: LucideProps) => (
		<svg
			aria-hidden="true"
			focusable="false"
			data-prefix="fab"
			data-icon="google"
			role="img"
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 48 48"
			{...props}
		>
			<path
				fill="#FFC107"
				d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
			/>
			<path
				fill="#FF3D00"
				d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
			/>
			<path
				fill="#4CAF50"
				d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
			/>
			<path
				fill="#1976D2"
				d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
			/>
		</svg>
	),
	sun: ({ ...props }: LucideProps) => (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="size-4.5"
			{...props}
		>
			<title>Toggle theme</title>
			<path stroke="none" d="M0 0h24v24H0z" fill="none" />
			<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
			<path d="M12 3l0 18" />
			<path d="M12 9l4.65 -4.65" />
			<path d="M12 14.3l7.37 -7.37" />
			<path d="M12 19.6l8.85 -8.85" />
		</svg>
	),
	loader: ({ size = 16, ...props }: LucideProps & { size?: number }) => {
		const clipPathId = useId();

		return (
			<svg
				height={size}
				strokeLinejoin="round"
				style={{ color: "currentcolor" }}
				viewBox="0 0 16 16"
				width={size}
				className="animate-spin"
				{...props}
			>
				<title>Loader</title>
				<g clipPath={`url(#${clipPathId})`}>
					<path d="M8 0V4" stroke="currentColor" strokeWidth="1.5" />
					<path
						d="M8 16V12"
						opacity="0.5"
						stroke="currentColor"
						strokeWidth="1.5"
					/>
					<path
						d="M3.29773 1.52783L5.64887 4.7639"
						opacity="0.9"
						stroke="currentColor"
						strokeWidth="1.5"
					/>
					<path
						d="M12.7023 1.52783L10.3511 4.7639"
						opacity="0.1"
						stroke="currentColor"
						strokeWidth="1.5"
					/>
					<path
						d="M12.7023 14.472L10.3511 11.236"
						opacity="0.4"
						stroke="currentColor"
						strokeWidth="1.5"
					/>
					<path
						d="M3.29773 14.472L5.64887 11.236"
						opacity="0.6"
						stroke="currentColor"
						strokeWidth="1.5"
					/>
					<path
						d="M15.6085 5.52783L11.8043 6.7639"
						opacity="0.2"
						stroke="currentColor"
						strokeWidth="1.5"
					/>
					<path
						d="M0.391602 10.472L4.19583 9.23598"
						opacity="0.7"
						stroke="currentColor"
						strokeWidth="1.5"
					/>
					<path
						d="M15.6085 10.4722L11.8043 9.2361"
						opacity="0.3"
						stroke="currentColor"
						strokeWidth="1.5"
					/>
					<path
						d="M0.391602 5.52783L4.19583 6.7639"
						opacity="0.8"
						stroke="currentColor"
						strokeWidth="1.5"
					/>
				</g>
				<defs>
					<clipPath id={clipPathId}>
						<rect fill="white" height="16" width="16" />
					</clipPath>
				</defs>
			</svg>
		);
	},
	loadingSpinner: ({ ...props }: LucideProps) => (
		<svg
			className="animate-spin -ml-1 mr-2 h-4 w-4"
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			aria-label="Loading"
			{...props}
		>
			<title>Loading spinner</title>
			<circle
				className="opacity-25"
				cx="12"
				cy="12"
				r="10"
				stroke="currentColor"
				strokeWidth="4"
			/>
			<path
				className="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			/>
		</svg>
	),
	vercel: ({ ...props }: LucideProps) => (
		<svg
			viewBox="0 0 76 65"
			className="h-3 w-3 mr-2"
			fill="currentColor"
			aria-label="Vercel Logo"
			{...props}
		>
			<title>Vercel Logo</title>
			<path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
		</svg>
	),
	gitHubLogo: ({ ...props }: LucideProps) => (
		<svg
			className="h-4 w-4 mr-2"
			fill="currentColor"
			viewBox="0 0 24 24"
			aria-label="GitHub Logo"
			{...props}
		>
			<title>GitHub Logo</title>
			<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
		</svg>
	),
	contextUsage: ({
		usedTokens,
		maxTokens,
		...props
	}: LucideProps & { usedTokens: number; maxTokens: number }) => {
		const ICON_RADIUS = 10;
		const ICON_VIEWBOX = 24;
		const ICON_CENTER = 12;
		const ICON_STROKE_WIDTH = 2;

		const circumference = 2 * Math.PI * ICON_RADIUS;
		const usedPercent = usedTokens / maxTokens;
		const dashOffset = circumference * (1 - usedPercent);

		return (
			<svg
				aria-label="Model context usage"
				height="20"
				role="img"
				style={{ color: "currentcolor" }}
				viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
				width="20"
				{...props}
			>
				<circle
					cx={ICON_CENTER}
					cy={ICON_CENTER}
					fill="none"
					opacity="0.25"
					r={ICON_RADIUS}
					stroke="currentColor"
					strokeWidth={ICON_STROKE_WIDTH}
				/>
				<circle
					cx={ICON_CENTER}
					cy={ICON_CENTER}
					fill="none"
					opacity="0.7"
					r={ICON_RADIUS}
					stroke="currentColor"
					strokeDasharray={`${circumference} ${circumference}`}
					strokeDashoffset={dashOffset}
					strokeLinecap="round"
					strokeWidth={ICON_STROKE_WIDTH}
					style={{ transformOrigin: "center", transform: "rotate(-90deg)" }}
				/>
			</svg>
		);
	},
};
