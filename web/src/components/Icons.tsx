import { Component, JSX } from 'solid-js';

interface IconProps extends JSX.SvgSVGAttributes<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
}

const defaultProps = {
  size: 20,
  strokeWidth: 1.75,
};

export const PlaneIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13.5 8.5 5.3 6.7c-.8-.2-1.6.1-2 .8l-.5.8 5.7 3.7-3.2 3.2-2.3-.5-.9.9 2.5 1.5 1.5 2.5.9-.9-.5-2.3 3.2-3.2 3.7 5.7.8-.5c.7-.4 1-1.2.8-2z" />
  </svg>
);

export const BarChartIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </svg>
);

export const SettingsIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const UsersIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const UserPlusIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" />
    <line x1="22" y1="11" x2="16" y2="11" />
  </svg>
);

export const XIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const TagIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
    <circle cx="7" cy="7" r="1.5" fill="currentColor" />
  </svg>
);

export const CreditCardIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <rect width="20" height="14" x="2" y="5" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
  </svg>
);

export const SearchIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

export const EditIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

export const TrashIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

export const ArrowLeftIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </svg>
);

export const ChevronRightIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export const PlusIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

export const MapPinIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export const CalendarIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

export const WalletIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a8 8 0 0 1-.4 2.8A2 2 0 0 1 18 20H4a2 2 0 0 1-2-2V7" />
    <path d="M19 12v3" />
  </svg>
);

export const CheckIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const CopyIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

export const ExternalLinkIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);

export const ClockIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export const ShieldIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export const ReceiptIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
    <path d="M16 8H8" />
    <path d="M16 12H8" />
    <path d="M13 16H8" />
  </svg>
);

export const LogoutIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export const FileTextIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

export const ChevronDownIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const BriefcaseIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

export const UploadIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? defaultProps.size}
    height={props.size ?? defaultProps.size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth ?? defaultProps.strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
    style={props.style}
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
