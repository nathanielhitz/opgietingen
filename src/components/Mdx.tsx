import { MDXRemote } from "next-mdx-remote/rsc";
import Link from "next/link";
import type { ComponentProps } from "react";
import type { GidsProduct } from "@/lib/content";
import { ProductCard } from "@/components/ProductCard";

/*
  Rendert de MDX-body van events, sauna's en gidsen als server component.
  Styling via component-overrides (geen typography-plugin nodig).

  Gidsen kunnen affiliate-producten inline plaatsen via <Product id="..." /> of
  alle producten tegelijk via <ProductGrid />. Beide componenten worden alleen
  geïnjecteerd wanneer `producten` is meegegeven (zie buildComponents).
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

function ProductGrid({ producten }: { producten: GidsProduct[] }) {
  if (producten.length === 0) return null;
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {producten.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

/**
 * Bouwt de components-map. Bij gidsen worden <Product id="..." /> en
 * <ProductGrid /> toegevoegd, gebonden aan de producten van díe gids.
 */
function buildComponents(producten?: GidsProduct[]) {
  if (!producten) return components;
  return {
    ...components,
    Product: ({ id }: { id?: string }) => {
      const product = producten.find((p) => p.id === id);
      if (!product) return null;
      return (
        <div className="mt-6 sm:max-w-sm">
          <ProductCard product={product} />
        </div>
      );
    },
    ProductGrid: () => <ProductGrid producten={producten} />,
  };
}

export function Mdx({ source, producten }: { source: string; producten?: GidsProduct[] }) {
  return (
    <div className="text-[0.975rem]">
      <MDXRemote source={source} components={buildComponents(producten)} />
    </div>
  );
}
