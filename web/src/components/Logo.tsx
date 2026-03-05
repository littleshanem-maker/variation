interface LogoProps {
  size?: number;
  className?: string;
}

export default function Logo({ size = 32, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Variation Shield"
    >
      {/* Shield body */}
      <path
        d="M16 2L5 6.8V15.6C5 22.2 9.8 28.1 16 30C22.2 28.1 27 22.2 27 15.6V6.8L16 2Z"
        fill="#4f46e5"
      />
      {/* Subtle top highlight — depth */}
      <path
        d="M16 4.2L7 8.4V15.6C7 21 11 26 16 27.7V4.2Z"
        fill="rgba(255,255,255,0.07)"
      />
      {/* V lettermark */}
      <path
        d="M10.5 12L16 21L21.5 12"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
