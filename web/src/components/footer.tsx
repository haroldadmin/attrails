import Link from "next/link";

export function Footer() {
  return (
    <footer className="footer sm:footer-horizontal p-10 max-w-7xl mx-auto px-4 sm:px-16 ">
      <nav>
        <h6 className="footer-title">Explore</h6>
        <ul className="flex flex-col gap-y-4 text-sm">
          <Link className="link link-hover" href="/routes?activity=running">
            Running
          </Link>
          <Link className="link link-hover" href="/routes?activity=cycling">
            Cycling
          </Link>
          <Link className="link link-hover" href="/routes?activity=hiking">
            Hiking
          </Link>
          <Link className="link link-hover" href="/routes?activity=walking">
            Walking
          </Link>
        </ul>
      </nav>
      <nav>
        <h6 className="footer-title">Resources</h6>
        <Link className="link link-hover" href="/about">
          About
        </Link>
        <Link className="link link-hover" href="/moderation">
          Moderation
        </Link>
        <Link className="link link-hover" href="/faq">
          FAQ
        </Link>
        <Link className="link link-hover" href="/privacy">
          Privacy
        </Link>
        <Link className="link link-hover" href="/terms">
          Terms
        </Link>
      </nav>
      <nav>
        <h6 className="footer-title">About</h6>
        <Link
          className="link link-hover"
          href="https://github.com/haroldadmin/attrails"
          target="_blank"
        >
          Source code
        </Link>
        <a
          className="link link-hover"
          href="https://bsky.app/profile/attrails.app"
        >
          @attrails.app
        </a>
      </nav>
    </footer>
  );
}
