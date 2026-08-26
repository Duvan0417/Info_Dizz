// Set de iconos lineales (estilo "feather") propios para el shell de navegación:
// trazo simple en currentColor, pensado para acompañar texto en la sidebar.
function Icon({ children, className = 'h-[18px] w-[18px]' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconHome(props) {
  return (
    <Icon {...props}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 9.5V19a1 1 0 0 0 1 1h3v-6h5v6h3a1 1 0 0 0 1-1V9.5" />
    </Icon>
  );
}

export function IconChart(props) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="12" width="4" height="8" rx="0.8" />
      <rect x="10" y="7.5" width="4" height="12.5" rx="0.8" />
      <rect x="16.5" y="4" width="4" height="16" rx="0.8" />
    </Icon>
  );
}

export function IconLock(props) {
  return (
    <Icon {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
    </Icon>
  );
}

export function IconDownload(props) {
  return (
    <Icon {...props}>
      <path d="M12 3v12" />
      <path d="M7 10.5 12 15.5 17 10.5" />
      <path d="M5 19.5h14" />
    </Icon>
  );
}

export function IconUsers(props) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8.2" r="3.2" />
      <path d="M2.8 20c0-3.4 2.8-6 6.2-6s6.2 2.6 6.2 6" />
      <circle cx="17.3" cy="8.7" r="2.4" />
      <path d="M15.8 14.2c2.6.6 4.4 2.6 4.4 5.8" />
    </Icon>
  );
}

export function IconTrophy(props) {
  return (
    <Icon {...props}>
      <path d="M7 4h10v4.5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4.5a2.5 2.5 0 0 0 2.5 3" />
      <path d="M17 5h2.5a2.5 2.5 0 0 1-2.5 3" />
      <path d="M12 13.5V17" />
      <path d="M8.5 20h7" />
      <path d="M9 17h6v3H9z" />
    </Icon>
  );
}

export function IconTarget(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function IconCoin(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9" />
      <path d="M14.8 9.8c0-1.1-1.25-2-2.8-2s-2.8.7-2.8 1.8c0 2.6 5.6 1.2 5.6 3.7 0 1.1-1.25 1.9-2.8 1.9s-2.8-.8-2.8-1.9" />
    </Icon>
  );
}

export function IconStore(props) {
  return (
    <Icon {...props}>
      <path d="M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9" />
      <path d="M3 6.5 4.5 3h15L21 6.5" />
      <path d="M3 6.5a2.3 2.3 0 0 0 4.6 0 2.3 2.3 0 0 0 4.6 0 2.3 2.3 0 0 0 4.6 0 2.3 2.3 0 0 0 4.6 0" />
      <path d="M9.5 20v-5.5h5V20" />
    </Icon>
  );
}

export function IconPrinter(props) {
  return (
    <Icon {...props}>
      <path d="M7 8.5V4h10v4.5" />
      <rect x="4" y="8.5" width="16" height="8" rx="1.5" />
      <path d="M7 14h10v6H7z" />
    </Icon>
  );
}

export function IconTag(props) {
  return (
    <Icon {...props}>
      <path d="M12.3 3.5h5.2a2 2 0 0 1 2 2v5.2a2 2 0 0 1-.6 1.4l-8 8a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8l8-8a2 2 0 0 1 1.4-.6Z" />
      <circle cx="16" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function IconChevronDown(props) {
  return (
    <Icon {...props}>
      <path d="M6 9.5 12 15.5 18 9.5" />
    </Icon>
  );
}

export function IconLogout(props) {
  return (
    <Icon {...props}>
      <path d="M9.5 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3.5" />
      <path d="M15.5 16.5 20 12l-4.5-4.5" />
      <path d="M20 12H9.5" />
    </Icon>
  );
}

export function IconMenu(props) {
  return (
    <Icon {...props}>
      <path d="M3.5 6.5h17" />
      <path d="M3.5 12h17" />
      <path d="M3.5 17.5h17" />
    </Icon>
  );
}

export function IconClose(props) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </Icon>
  );
}
