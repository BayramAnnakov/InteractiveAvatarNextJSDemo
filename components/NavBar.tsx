"use client";

import {
  Link,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
} from "@nextui-org/react";
import { GithubIcon } from "./Icons";

export default function NavBar() {
  return (
    <Navbar className="w-full">
      <NavbarBrand>
        <div className="bg-gradient-to-br from-sky-300 to-indigo-500 bg-clip-text">
          <p className="text-xl font-semibold text-transparent">
            Sales Associate
          </p>
        </div>
      </NavbarBrand>
      <NavbarContent justify="end">
        <NavbarItem>
          <Link
            isExternal
            aria-label="Github"
            href="https://github.com/BayramAnnakov/InteractiveAvatarNextJSDemo"
            className="flex flex-row justify-center gap-1 text-foreground"
          >
            <GithubIcon className="text-default-500" />
          </Link>
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  );
}
