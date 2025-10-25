import type { UIMessage } from "ai";
import type { DataPart } from "@/lib/ai/messages/data-parts";
import type { Metadata } from "@/lib/ai/messages/metadata";
import type { ToolSet } from "@/lib/ai/tools";

export type ChatUIMessage = UIMessage<Metadata, DataPart, ToolSet>;
