import { MDXRemote } from "next-mdx-remote/rsc";
import Link from "next/link";
import type { ComponentProps } from "react";

/*
  Rendert de MDX-body van events en sauna's als server component.
  Styling via component-overrides (geen typography-plugin nodig).
*/

const components = {
  h2: (props: ComponentProps<"h2">) => (
    <h2 className="mt-8 font-display text-xl font-semibold text-ink" {...props} />
  ),
  h3: (props: ComponentProps<"h3">) => (
    <h3 className="mt-6 font-display text-lg font-semibold text-ink" {...props} />
  ),
  p: (props: ComponentProps<"p">) => (
    <p className="mt-4 leading-relaxed text-ink-soft" {...props} />
  ),
  ul: (props: ComponentProps<"ul">) => (
    <ul className="mt-4 space-y-2 pl-1 text-ink-soft" {...props} />
  ),
  ol: (props: ComponentProps<"ol">) => (
    <ol className="mt-4 list-decimal space-y-2 pl-5 text-ink-soft" {...props} />
  ),
  li: (props: ComponentProps<"li">) => (
    <li className="flex gap-2 before:mt-2.5 before:h-1.5 before:w-1.5 before:flex-none before:rounded-full before:bg-ember-soft" {...props} />
  ),
  strong: (props: ComponentProps<"strong">) => (
    <strong className="font-semibold text-ink" {...props} />
  ),
  a: ({ href = "#", ...props }: ComponentProps<"a">) => (
    <Link href={href} className="font-medium text-ember underline underline-offset-2 hover:text-ember/80" {...props} />
  ),
  hr: () => <hr className="my-8 border-sand" />,
};

export function Mdx({ source }: { source: string }) {
  return (
    <div className="text-[0.975rem]">
      <MDXRemote source={source} components={components} />
    </div>
  );
}
