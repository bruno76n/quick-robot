import { PageHeader } from '../../components/AppShell';
import { es } from '../../i18n/es';

/** Screens of later phases: the sidebar keeps the mockup's structure. */
export function Placeholder({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <p className="max-w-[62ch] text-ink-2">{es.app.comingSoon}</p>
    </>
  );
}
