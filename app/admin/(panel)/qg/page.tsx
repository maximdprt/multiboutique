import { qgSnapshotData } from "@/lib/qg";
import { City } from "./City";

export const metadata = { title: "QG des agents" };

export default async function QG() {
  return <City initial={await qgSnapshotData()} />;
}
