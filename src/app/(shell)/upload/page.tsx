import type { Metadata } from "next";

import { UploadPage } from "@/components/upload/UploadPage";

export const metadata: Metadata = { title: "Upload | TikTok" };

export default function UploadRoute() {
  return <UploadPage />;
}
