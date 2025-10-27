import useSWR from "swr";

interface DisplayModel {
	id: string;
	label: string;
}

const fetcher = async (url: string) => {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error("Failed to fetch models");
	}
	return response.json();
};

export function useAvailableModels() {
	const { data, error, isLoading } = useSWR("/api/models", fetcher, {
		revalidateOnFocus: false,
		revalidateOnReconnect: false,
		dedupingInterval: 60000, // Cache for 1 minute
		retryCount: 3,
		retryDelay: 5000,
	});

	const models: DisplayModel[] = data?.models?.map(
		(model: { id: string; name: string }) => ({
			id: model.id,
			label: model.name,
		}),
	) || [];

	return { 
		models, 
		isLoading, 
		error: error || null 
	};
}
