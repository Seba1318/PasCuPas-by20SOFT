import { useCallback } from 'react';

// La trimiterea unui formular cu erori, mută focusul pe primul câmp greșit.
export function useFocusFirstError(order) {
  return useCallback(
    (errors) => {
      const first = order.find((name) => errors[name]);
      if (first) document.getElementById(first)?.focus();
    },
    [order],
  );
}
