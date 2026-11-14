import { PageHead } from '../components/PageHead';
import { es } from '../i18n/es';

/** Screens of later phases: the menu shows them, the content arrives with their phase (docs/10). */
export function NotYet({ title }: { title: string }) {
  return (
    <>
      <PageHead title={title} />
      <p className="muted">{es.screens.shell.notYet}</p>
    </>
  );
}
