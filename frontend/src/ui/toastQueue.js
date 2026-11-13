// Coada de toast-uri. Toast-urile nu expiră: rămân până le închide utilizatorul
// (design/Componente-Feedback · Toast), ca nimeni să nu piardă o confirmare citind încet.
export const MAX_TOASTS = 3;
let nextId = 1;

export function addToast(queue, { title, message = '', tone = 'success' }) {
  const last = queue[queue.length - 1];
  if (last && last.title === title && last.message === message) return queue;
  const next = [...queue, { id: nextId++, title, message, tone }];
  return next.slice(-MAX_TOASTS);
}

export const removeToast = (queue, id) => queue.filter((t) => t.id !== id);
