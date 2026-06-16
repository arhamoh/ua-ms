'use client';

import { motion } from 'motion/react';
import type { ComponentProps } from 'react';

// A drop-in <button> with a subtle press/hover spring. Safe to render from
// server components (only plain/serializable props are passed through).
export default function AnimatedButton({
  className,
  children,
  ...rest
}: ComponentProps<typeof motion.button>) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={className}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
