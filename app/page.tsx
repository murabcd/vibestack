import { Chat } from "./chat";
import { Header } from "./header";
import { Horizontal } from "@/components/layout/panels";
import { EnhancedPreview } from "@/components/enhanced-preview/enhanced-preview";
import { TabContent, TabItem } from "@/components/tabs";
import { cookies } from "next/headers";
import { getHorizontal } from "@/components/layout/sizing";

export default async function Page() {
	const store = await cookies();
	const horizontalSizes = getHorizontal(store);
	return (
		<div className="flex flex-col h-screen max-h-screen overflow-hidden p-2 space-x-2">
			<Header className="flex items-center w-full" />
			<ul className="flex space-x-5 font-mono text-sm tracking-tight px-1 py-2 md:hidden">
				<TabItem tabId="chat">Chat</TabItem>
				<TabItem tabId="preview">Preview</TabItem>
			</ul>

			<div className="flex flex-1 w-full overflow-hidden pt-2 md:hidden">
				<TabContent tabId="chat" className="flex-1">
					<Chat className="flex-1 overflow-hidden" />
				</TabContent>
				<TabContent tabId="preview" className="flex-1">
					<EnhancedPreview className="flex-1 overflow-hidden" />
				</TabContent>
			</div>

			<div className="hidden flex-1 w-full min-h-0 overflow-hidden pt-2 md:flex">
				<Horizontal
					defaultLayout={horizontalSizes ?? [30, 70]}
					left={<Chat className="flex-1 overflow-hidden" />}
					right={<EnhancedPreview className="flex-1 overflow-hidden" />}
				/>
			</div>
		</div>
	);
}
