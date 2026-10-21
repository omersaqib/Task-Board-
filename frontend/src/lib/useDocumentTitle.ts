import { useEffect } from 'react';

export const APP_NAME = 'TaskBoard';

/** Sets `document.title` to "<page> · TaskBoard" while the calling page is mounted. */
export function useDocumentTitle(page: string) {
  useEffect(() => {
    document.title = page ? `${page} · ${APP_NAME}` : APP_NAME;
  }, [page]);
}
