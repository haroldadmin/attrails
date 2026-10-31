import type { ReactNode } from "react";

export type FaqItemProps = {
  // The fragment identifier that links to this question, as in `/faq#<id>`.
  id: string;
  question: string;
  children: ReactNode;
};

/**
 * One question in the FAQ accordion. Items share a `name`, so opening one
 * closes the others.
 */
export function FaqItem({ id, question, children }: FaqItemProps) {
  return (
    <details
      id={id}
      name="faq"
      className="collapse collapse-arrow scroll-mt-8 border border-base-300"
    >
      <summary className="collapse-title font-serif text-xl">
        {question}
      </summary>
      <div className="collapse-content prose prose-attrails">{children}</div>
    </details>
  );
}
