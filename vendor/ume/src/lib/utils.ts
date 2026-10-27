import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/* tailwind-merge only knows Tailwind's default type scale, so it read our
   custom sizes (`text-figure`, `text-hero`, `text-label-mono` from index.css) as colours and
   dropped them whenever a `text-<colour>` class came later in the same cn()
   call. Registering them as font sizes keeps both. */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["figure", "hero", "label-mono", "label-mono-lg", "label-lg", "title-lg", "body-lg"],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
