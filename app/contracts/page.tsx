import { getWorkspaceStore } from "@/lib/db";
import ContractsClient from "./contracts-client";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const store = await getWorkspaceStore();
  const workflows = await store.workflows.list();
  const contracts = await store.contracts.list();
  const connections = await store.connections.list();
  return <ContractsClient workflows={workflows} contracts={contracts} connections={connections} />;
}
