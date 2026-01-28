import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Component that scrolls to top on route changes
 * This ensures that when navigating between pages, the scroll position resets to top
 */
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  // Disable browser's automatic scroll restoration
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    const scrollToTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      const mainElement = document.querySelector('.main');
      if (mainElement) {
        mainElement.scrollTop = 0;
      }
    };

    // Scroll immediately
    scrollToTop();

    // Also scroll after a frame to override any browser restoration
    requestAnimationFrame(() => {
      scrollToTop();
    });

    // And again after a short delay as a fallback
    const timeoutId = setTimeout(scrollToTop, 0);

    return () => clearTimeout(timeoutId);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
