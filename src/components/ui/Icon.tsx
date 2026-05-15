import type { SVGProps } from "react";
import { cn } from "@/lib/ui/cn";

export type IconName =
  | "arrow-left"
  | "arrow-right"
  | "check"
  | "chevron-down"
  | "dashboard"
  | "delete"
  | "filter"
  | "globe"
  | "print"
  | "report"
  | "save"
  | "search"
  | "settings"
  | "users";

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
};

const paths: Record<IconName, string[]> = {
  "arrow-left": ["M19 12H5", "M12 19l-7-7 7-7"],
  "arrow-right": ["M5 12h14", "M12 5l7 7-7 7"],
  check: ["M20 6 9 17l-5-5"],
  "chevron-down": ["m6 9 6 6 6-6"],
  dashboard: [
    "M3 13h8V3H3v10Z",
    "M13 21h8V11h-8v10Z",
    "M13 9h8V3h-8v6Z",
    "M3 21h8v-6H3v6Z",
  ],
  delete: ["M3 6h18", "M8 6V4h8v2", "M6 6l1 15h10l1-15"],
  filter: ["M4 5h16l-6 7v5l-4 2v-7L4 5Z"],
  globe: [
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
    "M3.6 9h16.8",
    "M3.6 15h16.8",
    "M12 3c2.2 2.5 3.2 5.5 3.2 9S14.2 18.5 12 21",
    "M12 3C9.8 5.5 8.8 8.5 8.8 12s1 6.5 3.2 9",
  ],
  print: ["M7 8V3h10v5", "M7 17H5a2 2 0 0 1-2-2v-5h18v5a2 2 0 0 1-2 2h-2", "M7 14h10v7H7v-7Z"],
  report: ["M7 3h7l5 5v13H7V3Z", "M14 3v5h5", "M10 13h6", "M10 17h6"],
  save: ["M5 3h12l2 2v16H5V3Z", "M8 3v6h8V3", "M8 17h8"],
  search: ["M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z", "m21 21-4.3-4.3"],
  settings: ["M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 3.1-.2-.1a1.7 1.7 0 0 0-1.9.3l-.2.1-3.6-2.1-.1-.2a1.7 1.7 0 0 0-1.8 0l-.2.1-3.6 2.1-.2-.1a1.7 1.7 0 0 0-1.9-.3l-.2.1-1.8-3.1.1-.1A1.7 1.7 0 0 0 4.6 15v-.2L2.8 13v-2l1.8-1.8V9a1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-3.1.2.1a1.7 1.7 0 0 0 1.9-.3l.2-.1L10 5.7l.2.1a1.7 1.7 0 0 0 1.8 0l.2-.1 3.6-2.1.2.1a1.7 1.7 0 0 0 1.9.3l.2-.1 1.8 3.1-.1.1a1.7 1.7 0 0 0-.3 1.9v.2L21.2 11v2l-1.8 1.8v.2Z"],
  users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M22 21v-2a4 4 0 0 0-3-3.9", "M16 3.1a4 4 0 0 1 0 7.8"],
};

export function Icon({ className, name, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={cn("h-4 w-4 shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      {...props}
    >
      {paths[name].map((d) => (
        <path d={d} key={d} />
      ))}
    </svg>
  );
}
