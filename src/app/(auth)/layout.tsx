import Link from "next/link";
import { Logo } from "@/components/ui/primitives";
import { DemoModeNotice } from "@/components/app/demo-notice";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-10">
      <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" aria-hidden />
      <div className="absolute left-1/2 top-0 h-60 w-[40rem] max-w-full -translate-x-1/2 rounded-full bg-brand/10 blur-3xl" aria-hidden />
      <main id="conteudo" className="relative w-full max-w-sm animate-rise">
        <Link href="/" className="mb-8 flex justify-center" aria-label="ScaleX — início">
          <Logo className="text-lg" />
        </Link>
        <div className="rounded-2xl border border-border bg-surface/95 p-6 shadow-2xl backdrop-blur sm:p-7">{children}</div>
        <DemoModeNotice className="mt-4" />
      </main>
    </div>
  );
}
