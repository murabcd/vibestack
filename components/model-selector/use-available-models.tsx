import useSWR from "swr";

interface DisplayModel {
	id: string;
	label: string;
}

export function useAvailableModels() {
	const { data, error, isLoading } = useSWR<{
		models: Array<{ id: string; name: string }>;
	}>("/api/models", {
		revalidateOnFocus: false,
		revalidateOnReconnect: false,
		dedupingInterval: 60000, // Cache for 1 minute
		errorRetryCount: 3,
		errorRetryInterval: 5000,
	});

	const models: DisplayModel[] =
		data?.models?.map((model) => ({
			id: model.id,
			label: model.name,
		})) || [];

	return {
		models,
		isLoading,
		error: error || null,
	};
}
