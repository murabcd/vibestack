"use client";

const GENERATING_PROJECT_STORAGE_KEY = "generating-project-id";
const GENERATING_PROJECT_EVENT = "vibestack:generating-project-change";

function emitGeneratingProjectChange() {
	window.dispatchEvent(new CustomEvent(GENERATING_PROJECT_EVENT));
}

export function getGeneratingProjectId() {
	if (typeof window === "undefined") return null;
	return window.localStorage.getItem(GENERATING_PROJECT_STORAGE_KEY);
}

export function setGeneratingProjectId(projectId: string) {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(GENERATING_PROJECT_STORAGE_KEY, projectId);
	emitGeneratingProjectChange();
}

export function clearGeneratingProjectId(projectId?: string) {
	if (typeof window === "undefined") return;
	const currentProjectId = window.localStorage.getItem(
		GENERATING_PROJECT_STORAGE_KEY,
	);
	if (projectId && currentProjectId !== projectId) return;
	window.localStorage.removeItem(GENERATING_PROJECT_STORAGE_KEY);
	emitGeneratingProjectChange();
}

export function subscribeToGeneratingProjectChange(
	onChange: (projectId: string | null) => void,
) {
	if (typeof window === "undefined") {
		return () => undefined;
	}

	const sync = () => {
		onChange(getGeneratingProjectId());
	};

	const handleStorage = (event: StorageEvent) => {
		if (event.key && event.key !== GENERATING_PROJECT_STORAGE_KEY) return;
		sync();
	};

	window.addEventListener("storage", handleStorage);
	window.addEventListener(GENERATING_PROJECT_EVENT, sync);

	return () => {
		window.removeEventListener("storage", handleStorage);
		window.removeEventListener(GENERATING_PROJECT_EVENT, sync);
	};
}
