import type { Metadata } from "next";

import { AddEmailPage } from "@/components/auth/AddEmailPage";

export const metadata: Metadata = { title: "Add your email | Nowa" };

/** Where a social login lands when the provider gave us no address. */
export default function AddEmailRoute() {
  return <AddEmailPage />;
}
