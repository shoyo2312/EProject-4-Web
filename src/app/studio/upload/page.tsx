import type { Metadata } from "next";

import { UploadPage } from "@/components/upload/UploadPage";

export const metadata: Metadata = { title: "Upload | Nowa Studio" };

export default function StudioUploadRoute() {
  return <UploadPage />;
}
