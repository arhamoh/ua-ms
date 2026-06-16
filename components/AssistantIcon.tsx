// The Analytics Assistant's brand mark — the UA Digital ribbon logo, inlined so
// it inherits the current text color (white on the brand button, brand-colored
// in nav/headers). Drop-in replacement for a lucide icon (size/className).
export default function AssistantIcon({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path
        d="M 11.865,4.152 C 11.111,4.393 10.944,4.576 10.017,6.178 C 9.619,6.864 9.033,7.853 8.714,8.371 C 8.4,8.889 7.882,9.737 7.567,10.256 C 6.698,11.69 6.651,11.753 6.353,11.905 C 5.51,12.334 4.563,11.816 4.505,10.889 C 4.479,10.486 4.453,10.544 5.552,8.696 C 6.955,6.34 7.044,5.743 6.133,4.859 C 5.013,3.77 3.704,4.147 2.636,5.858 C 0.569,9.162 0.6,9.088 0.6,10.57 C 0.6,15.234 6.144,17.668 9.588,14.522 C 10.017,14.129 10.263,13.779 10.986,12.528 C 12.258,10.318 12.378,10.125 12.467,10.125 C 12.572,10.125 12.645,10.219 13.299,11.276 C 13.629,11.81 14.278,12.847 14.734,13.58 C 15.189,14.313 15.66,15.019 15.775,15.145 C 16.938,16.412 19.042,15.684 19.372,13.904 C 19.471,13.376 19.398,13.239 17.623,10.564 C 16.744,9.24 15.598,7.466 15.069,6.618 C 13.912,4.749 13.833,4.639 13.488,4.403 C 12.98,4.058 12.425,3.974 11.865,4.152"
        fill="currentColor"
      />
    </svg>
  );
}
