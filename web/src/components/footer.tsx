import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full max-w-7xl mx-auto px-4 sm:px-16">
      <nav aria-label="Footer" className="py-4 border-t border-base-300">
        <ul className="flex flex-row flex-wrap gap-x-6 gap-y-2 text-sm">
          <li>
            <Link className="link-hover" href="/">
              Home
            </Link>
          </li>
          <li>
            <Link className="link-hover" href="/routes?activity=running">
              Running
            </Link>
          </li>
          <li>
            <Link className="link-hover" href="/routes?activity=cycling">
              Cycling
            </Link>
          </li>
          <li>
            <Link className="link-hover" href="/routes?activity=hiking">
              Hiking
            </Link>
          </li>
          <li>
            <Link className="link-hover" href="/routes?activity=walking">
              Walking
            </Link>
          </li>
          <li>
            <Link className="link-hover" href="/about">
              About
            </Link>
          </li>
          <li>
            <Link className="link-hover" href="/moderation">
              Moderation
            </Link>
          </li>
          <li>
            <Link className="link-hover" href="/faq">
              FAQ
            </Link>
          </li>
          <li>
            <Link className="link-hover" href="/privacy">
              Privacy
            </Link>
          </li>
          <li>
            <Link className="link-hover" href="/terms">
              Terms
            </Link>
          </li>
          <li>
            <Link
              className="link-hover"
              href="https://github.com/haroldadmin/attrails"
              target="_blank"
            >
              Source code
            </Link>
          </li>
          <li>
            <a
              className="link-hover"
              href="https://bsky.app/profile/attrails.app"
            >
              @attrails.app on Bluesky
            </a>
          </li>
        </ul>
      </nav>
    </footer>
  );
}
