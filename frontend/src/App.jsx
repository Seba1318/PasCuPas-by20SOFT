import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { PrefsProvider } from './accessibility/PrefsProvider.jsx';
import { AuthProvider } from './auth/AuthProvider.jsx';
import { ToastProvider } from './ui/Toast.jsx';
import { routes } from './routes.jsx';

const router = createBrowserRouter(routes);

export default function App() {
  return (
    <PrefsProvider>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </PrefsProvider>
  );
}
