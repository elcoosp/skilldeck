import { motion } from 'framer-motion';

export function BouncingDots() {
  return (
    <div className="flex items-center justify-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full bg-primary"
          animate={{ y: [0, -8, 0] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.16,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}
