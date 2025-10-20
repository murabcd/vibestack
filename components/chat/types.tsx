import type { Metadata } from "@/lib/ai/messages/metadata";
import type { DataPart } from "@/lib/ai/messages/data-parts";
import type { ToolSet } from "@/lib/ai/tools";
import type { UIMessage } from "ai";

export type ChatUIMessage = UIMessage<Metadata, DataPart, ToolSet>;
