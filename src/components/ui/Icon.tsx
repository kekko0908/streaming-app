type IconName =
  | "check"
  | "x"
  | "star"
  | "crown"
  | "volume-off"
  | "volume"
  | "trophy"
  | "play"
  | "pin"
  | "lightbulb"
  | "settings"
  | "edit"
  | "clock"
  | "film"
  | "tv"
  | "sparkles"
  | "warning"
  | "lock"
  | "unlock"
  | "menu"
  | "bell"
  | "bell-off"
  | "chevron-left"
  | "chevron-right";

const paths: Record<IconName, JSX.Element> = {
  check: <polyline points="20 6 9 17 4 12" />,
  x: (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  crown: <path d="M2 8l5 4 5-7 5 7 5-4-2 11H4L2 8z" />,
  "volume-off": (
    <>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </>
  ),
  volume: (
    <>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </>
  ),
  trophy: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM5 5H3v2a4 4 0 0 0 4 4M19 5h2v2a4 4 0 0 1-4 4" />,
  play: <polygon points="5 3 19 12 5 21 5 3" />,
  pin: <path d="M12 17v5M9 10l-4 4M15 10l4 4M7 3h10l-2 7H9L7 3z" />,
  lightbulb: <path d="M9 18h6M10 22h4M8 14a6 6 0 1 1 8 0c-.8.7-1 1.5-1 2H9c0-.5-.2-1.3-1-2z" />,
  settings: <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-2 .2 1.7 1.7 0 0 0-.8 1.6V22H9.2v-.2a1.7 1.7 0 0 0-.8-1.6 1.7 1.7 0 0 0-2-.2l-.2.1-2-3.4.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.4-1.1H3v-3.8h.2A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.4.2.1a1.7 1.7 0 0 0 2-.2 1.7 1.7 0 0 0 .8-1.6V2h5.6v.2a1.7 1.7 0 0 0 .8 1.6 1.7 1.7 0 0 0 2 .2l.2-.1 2 3.4-.1.1A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.4 1.1h.2v3.8h-.2A1.7 1.7 0 0 0 19.4 15z" />,
  edit: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  film: <path d="M4 4h16v16H4zM8 4v16M16 4v16M4 8h4M4 16h4M16 8h4M16 16h4" />,
  tv: <path d="M4 7h16v11H4zM9 21h6M8 3l4 4 4-4" />,
  sparkles: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM5 16l.8 2.2L8 19l-2.2.8L5 22l-.8-2.2L2 19l2.2-.8L5 16z" />,
  warning: <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" />,
  lock: (
    <>
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V8a5 5 0 0 1 10 0v3" />
    </>
  ),
  unlock: (
    <>
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V8a5 5 0 0 1 9.9-1" />
    </>
  ),
  menu: (
    <>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </>
  ),
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />,
  "bell-off": (
    <>
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      <path d="M18.6 13.5C18.2 12.2 18 10.4 18 8a6 6 0 0 0-9.3-5" />
      <path d="M6 8c0 7-3 7-3 9h14" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </>
  ),
  "chevron-left": <polyline points="15 18 9 12 15 6" />,
  "chevron-right": <polyline points="9 18 15 12 9 6" />,
};

export function Icon({ name, size = 18, className, title }: { name: IconName; size?: number; className?: string; title?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      {paths[name]}
    </svg>
  );
}
