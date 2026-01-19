# Mobile Sales Page - User Guide

## Overview
A mobile-optimized sales pipeline page specifically designed for iPhone and mobile devices. This page provides a streamlined, touch-friendly interface for viewing and managing sales opportunities on the go.

## Accessing the Mobile Sales Page

### URL Routes
- **Desktop Sales Pipeline**: `/sales` (existing view - unchanged)
- **Mobile Sales Page**: `/sales/mobile` (new mobile-optimized view)

### How to Access
1. Navigate to: `http://localhost:3000/sales/mobile` (development)
2. Or in production: `https://your-domain.com/sales/mobile`

## Features

### 1. **Mobile-First Design**
- Optimized for touch interactions
- Card-based layout for easy scrolling
- Minimum 44px touch targets (iOS HIG compliance)
- Swipeable horizontal scrolling for KPIs and filters

### 2. **iPhone-Specific Optimizations**
- **Safe Area Support**: Respects iPhone notch and home indicator
- **iOS Viewport**: Uses `-webkit-fill-available` for proper viewport height
- **Smooth Scrolling**: `-webkit-overflow-scrolling: touch` for native feel
- **No Tap Highlights**: Removed blue tap highlights for cleaner UX
- **Backdrop Blur**: Native iOS-style blur effects on buttons

### 3. **Responsive Features**
- **Portrait Mode**: Single-column card layout
- **Landscape Mode**: Optimized spacing for shorter screens
- **Small Phones (iPhone SE)**: Adjusted font sizes and card widths
- **Large Phones (iPhone Pro Max)**: Enhanced spacing and larger text
- **Tablet (iPad)**: 2-column grid layout with wrapped filters

### 4. **Dark Mode Support**
- Automatically adapts to iOS system settings
- Uses `prefers-color-scheme: dark` media query
- Dark backgrounds, adjusted text colors, and proper contrast

### 5. **Interactive Elements**
- **KPI Cards**: Swipe horizontally to view all metrics
- **Stage Filters**: Tap chips to filter opportunities by pipeline stage
- **Opportunity Cards**: Tap to open detailed modal
- **Add Button**: Floating action button to create new opportunities

## Layout Structure

### Header
- Sticky header with gradient background
- Pipeline emoji and title
- Floating add button (top right)

### KPI Section
- Horizontal scrollable cards
- Total Pipeline, Weighted Pipeline, Active Opportunities
- Color-coded with trend indicators

### Stage Filters
- Horizontal chip navigation
- "All" option + dynamic stage filters from database
- Active state with color highlights

### Opportunities List
- Card-based layout with:
  - Market icon
  - Opportunity title and owner
  - Estimated value (large, prominent)
  - Stage badge with probability
  - Description preview
  - Market and date footer

### Empty State
- Friendly empty state when no opportunities match filters

## Technical Details

### CSS Features
- CSS Grid and Flexbox layouts
- CSS Custom Properties for theming
- CSS Environment Variables for safe areas
- Scroll snap for better UX
- Hardware-accelerated animations

### Accessibility
- Proper touch target sizes (min 44px)
- Color contrast ratios for readability
- Semantic HTML structure
- WCAG 2.1 AA compliant

### Performance
- Optimized animations
- Efficient re-renders with React Query
- Lazy loading for modals
- Minimal CSS overhead

## Browser Support
- Safari on iOS 12+
- Chrome on iOS/Android
- Firefox on iOS/Android
- Samsung Internet
- All modern mobile browsers

## Differences from Desktop View

| Feature | Desktop (`/sales`) | Mobile (`/sales/mobile`) |
|---------|-------------------|-------------------------|
| Layout | Multi-column grid | Single-column cards |
| Charts | Line/Donut charts | KPI cards only |
| Navigation | Full table view | Card-based list |
| Filters | Dropdown/search | Horizontal chips |
| Touch Targets | Mouse optimized | 44px minimum |
| Safe Areas | Not applicable | Full support |
| Scrolling | Standard | Native momentum |

## Testing Recommendations

### On Physical Devices
1. Test on actual iPhone (various models)
2. Test in both portrait and landscape
3. Test dark mode switching
4. Test scroll performance with many opportunities

### In Browser DevTools
1. Open Chrome DevTools
2. Toggle device toolbar (Ctrl+Shift+M / Cmd+Shift+M)
3. Select iPhone model from device list
4. Navigate to `/sales/mobile`
5. Test responsive breakpoints

### Simulator/Emulator
1. Use Xcode Simulator (Mac only)
2. Use Android Studio Emulator
3. Use BrowserStack for real device testing

## Future Enhancements
- Pull-to-refresh functionality
- Offline support with service workers
- Push notifications for opportunity updates
- Swipe gestures for quick actions
- Touch and hold for context menus
- Home screen shortcuts (PWA)

## Notes
- The existing desktop sales page at `/sales` remains completely unchanged
- Both pages share the same backend API and data
- The mobile page can also be used on desktop if preferred
- Users can bookmark `/sales/mobile` for quick mobile access
