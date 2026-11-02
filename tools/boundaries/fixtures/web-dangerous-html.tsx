// NEGATIVE FIXTURE — security: injected markup in apps/web. Must be rejected.
export const Broken = ({ html }: { html: string }) => <div dangerouslySetInnerHTML={{ __html: html }} />;
