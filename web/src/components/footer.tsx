import { AtTrailsLogo } from "@/components/logo";

export function Footer() {
  return (
    <footer className="w-full max-w-7xl mx-auto px-4 sm:px-16">
      <div className="footer sm:footer-horizontal py-4 border-t border-base-300 flex flex-row justify-between gap-2 items-baseline">
        <AtTrailsLogo size="small" />
        <p>Built on the open social web with ATProto</p>
      </div>
    </footer>
  );
}
