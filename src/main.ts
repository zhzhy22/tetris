import './style.css';
import { createApp } from './ui/app';

const mount = document.querySelector<HTMLElement>('#app');

if (!mount) {
  throw new Error('Root element "#app" not found');
}

const app = createApp({ mount });

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    app.destroy();
  });
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const registerServiceWorker = async () => {
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch (error) {
      console.warn('Service worker registration failed', error);
    }
  };

  if (document.readyState === 'complete') {
    void registerServiceWorker();
  } else {
    window.addEventListener('load', () => {
      void registerServiceWorker();
    });
  }
}
