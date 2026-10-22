import Link from "next/link";

export function TopNav() {
  return (
    <nav className="navbar">
      <ul className="flex flex-row flex-wrap gap-4">
        <li>
          <Link className="link-hover" href="/">
            Discover
          </Link>
        </li>
      </ul>
    </nav>
  );
}
